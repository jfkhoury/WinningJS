"use strict";

var ko = require("knockoutify");

exports.observableArrayFromVector = function (vector, mapping) {
    function singleArgMapping(element) {
        // Don't let `Array.prototype.map` pass through index and array arguments. If that happened, then e.g. removing
        // an element from the array would mean needing to re-map all elements after it, since their indices changed.
        // We don't want to support that use case, so ensure that at all times `mapping` gets only a single argument.
        return mapping(element);
    }
    var array = ko.observableArray(vector.map(singleArgMapping));

    vector.addEventListener("vectorchanged", function (ev) {
        switch (ev.collectionChange) {
        case Windows.Foundation.Collections.CollectionChange.reset:
            array.removeAll();
            array.push.apply(array, vector.map(mapping));
            break;
        case Windows.Foundation.Collections.CollectionChange.itemInserted:
            array.splice(ev.index, 0, mapping(vector[ev.index]));
            break;
        case Windows.Foundation.Collections.CollectionChange.itemRemoved:
            array.splice(ev.index, 1);
            break;
        case Windows.Foundation.Collections.CollectionChange.itemChanged:
            array.splice(ev.index, 1, mapping(vector[ev.index]));
            break;
        }
    });

    return array;
};

exports.addBindings = function () {
    // TODO: generalize to any winControl event.
    ko.bindingHandlers.itemInvoked = {
        init: function (element, valueAccessor) {
            var winControl = element.winControl;
            if (!winControl) {
                throw new Error("Cannot listen to itemInvoked on an element that does not own a winControl.");
            }

            var handler = valueAccessor();

            winControl.addEventListener("iteminvoked", function () {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(winControl);
                handler.apply(this, args);
            });
        }
    };

    ko.bindingHandlers.component = {
        init: function (placeholderEl, valueAccessor) {
            var component = ko.utils.unwrapObservable(valueAccessor());

            var componentEl = component.render();
            ko.virtualElements.setDomNodeChildren(placeholderEl, [componentEl]);

            return { controlsDescendantBindings: true };
        }
    };
    ko.virtualElements.allowedBindings.component = true;

    var VOREACH_KEY = "__ko_voreach_vectorObservableArray";

    function createVoreachValueAccessor(element) {
        return function () {
            return element[VOREACH_KEY];
        };
    }

    ko.bindingHandlers.voreach = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var winRTObservableVector = ko.utils.unwrapObservable(valueAccessor());
            element[VOREACH_KEY] = ko.observableArray(winRTObservableVector);

            winRTObservableVector.addEventListener("vectorchanged", function () {
                element[VOREACH_KEY].valueHasMutated();
            });

            return ko.bindingHandlers.foreach.init(
                element, createVoreachValueAccessor(element), allBindingsAccessor, viewModel, bindingContext
            );
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers.foreach.update(
                element, createVoreachValueAccessor(element), allBindingsAccessor, viewModel, bindingContext
            );
        }
    };
    ko.virtualElements.allowedBindings.voreach = true;
};
