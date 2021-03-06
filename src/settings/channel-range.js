//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

//css & images
require('../../node_modules/jquery-ui/themes/base/spinner.css');
require('../../node_modules/spectrum-colorpicker/spectrum.css');
require('../css/images/close.gif');
require('../css/images/colorpicker.png');

// js
import Context from '../app/context';
import Misc from '../utils/misc';
import {CHANNEL_SETTINGS_MODE,URI_PREFIX} from '../utils/constants';
import {HISTOGRAM_RANGE_UPDATE} from '../events/events';
import {inject, customElement, bindable, BindingEngine} from 'aurelia-framework';
import {spinner} from 'jquery-ui/ui/widgets/spinner';
import {slider} from 'jquery-ui/ui/widgets/slider';
import {spectrum} from 'spectrum-colorpicker';

/**
 * A channel range widget
 */

@customElement('channel-range')
@inject(Context, Element, BindingEngine)
export default class ChannelRange  {
    /**
     * channel informetion (bound in template)
     * @memberof ChannelRange
     * @type {Object}
     */
    @bindable channel = null;

    /**
     * the channel index
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable index = null;

    /**
     * the channel settings mode
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable mode = 0;

    /**
     * the luts png properties
     * @memberof ChannelRange
     * @type {Object}
     */
    @bindable luts_png = {
        url: '',
        height: 0
    };

    /**
     * the channels settings change mode handler
     * @memberof ChannelRange
     * @type {function}
     */
    @bindable change_mode = null;

    /**
     * the revision count (used for history)
     * @memberof ChannelRange
     * @type {number}
     */
    @bindable revision = 0;

    /**
     * property observers
     * @memberof ChannelRange
     * @type {Array.<object>}
     */
    observers = [];

    /**
     * the absolute channel range limits
     * @memberof ChannelRange
     * @type {Array.<number>}
     */
    @bindable range = null;

    /**
     * the lookup tables (bound via channel-settings
     * @memberof ChannelRange
     * @type {Array.<Object>}
     */
    @bindable luts = null;

    /**
     * @constructor
     * @param {Context} context the application context (injected)
     */
    constructor(context, element, bindingEngine, bindingContext) {
        this.context = context;
        this.element = element;
        this.bindingEngine = bindingEngine;
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is bound within aurelia
     * in other words an 'init' hook that happens before 'attached'
     *
     * @memberof ChannelRange
     */
    bind() {
        this.registerObservers();
        this.updateUI();
    }

    /**
     * Registers property observers
     * @memberof ChannelRange
     */
    registerObservers() {
        this.unregisterObservers();
        this.observers.push(
            this.bindingEngine.propertyObserver(this.luts_png, 'height')
                .subscribe((newValue, oldValue) => this.updateUI()));
        this.observers.push(
            this.bindingEngine.propertyObserver(this, 'mode')
                .subscribe((newValue, oldValue) =>
                    this.changeMode(newValue, oldValue)));
        this.observers.push(
            this.bindingEngine.propertyObserver(this, 'revision')
                .subscribe((newValue, oldValue) => {
                    let imgInf =
                        this.context.getSelectedImageConfig().image_info;
                    imgInf.initial_values = true;
                    this.updateUI();
                }));
    }

    /**
     * Deals with the mode change triggered by the observer
     *
     * @memberof ChannelRange
     */
    changeMode(newValue, oldValue) {
        if (newValue === null) return;
        if (oldValue === null) oldValue = newValue;

        let adjustRange = (() => {
            // delegate for clarity and to break up code
            this.changeMode0(newValue);
            this.updateUI();
        });
        // for imported we do this (potentilly) async
        if (newValue === CHANNEL_SETTINGS_MODE.IMPORTED)
            this.context.getSelectedImageConfig().image_info.
                requestImportedData(adjustRange);
        else adjustRange();
    }

    /**
     * Deals with the mode change triggered by the observer.
     * Should never be called by itself but by changeMode (see above)
     *
     * @private
     * @param {number} newValue the new value for 'mode'
     * @memberof ChannelRange
     */
    changeMode0(newValue) {
        let imgInfo =  this.context.getSelectedImageConfig().image_info;
        // set appropriate start and end values
        let minMaxValues =
            imgInfo.getChannelMinMaxValues(newValue, this.index);
        if (this.channel.window.start !== minMaxValues.start_val)
             this.channel.window.start = minMaxValues.start_val;
        if (this.channel.window.end !== minMaxValues.end_val)
            this.channel.window.end = minMaxValues.end_val;
        // we have to also reset channel color, dimensions
        // model and projection
        if (newValue === CHANNEL_SETTINGS_MODE.IMPORTED) {
            let impImgData = imgInfo.imported_settings;
            // channel color reset
            if (this.channel.color !== impImgData.c[this.index].color)
                this.channel.color = impImgData.c[this.index].color;
            // reverse intensity
            if (this.channel.reverseIntensity !==
                    impImgData.c[this.index].reverseIntensity)
                this.channel.reverseIntensity =
                    impImgData.c[this.index].reverseIntensity;
            // active reset
            if (this.channel.active !== impImgData.c[this.index].active)
                 this.channel.active = impImgData.c[this.index].active;
            // z,t dimension reset
            if (imgInfo.dimensions.t !== impImgData.t)
                imgInfo.dimensions.t = impImgData.t;
            if (imgInfo.dimensions.z !== impImgData.z)
                imgInfo.dimensions.z = impImgData.z;
            // model and projection
            if (imgInfo.model !== impImgData.m)
                imgInfo.model = impImgData.m;
            if (imgInfo.projection !== impImgData.p)
                imgInfo.projection = impImgData.p;
        }
    }

    /**
     * Unregisters the observers
     *
     * @memberof ChannelRange
     */
    unregisterObservers() {
        if (this.observers) {
            this.observers.map((obs) => obs.dispose());
            this.observers = [];
        }
    }

     /**
      * Overridden aurelia lifecycle method:
      * fired when PAL (dom abstraction) is unmounted
      *
      * @memberof ChannelSettings
      */
     detached() {
         // tear down jquery elements
         try {
             $(this.element).find(".channel-start").off();
             $(this.element).find(".channel-start").spinner("destroy");
             $(this.element).find(".channel-end").off();
             $(this.element).find(".channel-end").spinner("destroy");
             $(this.element).find(".channel-slider").slider("destroy");
             $(this.element).find(".spectrum-input").spectrum("destroy");
         } catch (ignored) {}
     }

     /**
      * Updates the UI elements (jquery)
      *
      * @memberof ChannelRange
      */
     updateUI() {
        // just in case
        this.detached();

        if (this.channel === null) return;

        let imgConf = this.context.getSelectedImageConfig();
        let imgInf = imgConf.image_info;
        let minMaxRange =
            imgInf.getChannelMinMaxValues(
                CHANNEL_SETTINGS_MODE.FULL_RANGE,this.index);
        let minMaxValues =
            imgInf.getChannelMinMaxValues(this.mode,this.index);

         // channel start
         let channelStart = $(this.element).find(".channel-start");
         channelStart.spinner(
             {min: minMaxRange.start_min, max: minMaxRange.start_max});
         let channelStartArrows =
            $(channelStart).parent().find('a.ui-spinner-button');
         channelStartArrows.css('display','none');
         channelStart.on("focus",
             (event) => channelStartArrows.css('display','block'));
         channelStart.on("blur",
                (event) => {
                    channelStartArrows.css('display','none');
                    this.onRangeChange(event.target.value, true, true);
                });
         channelStart.on("spinstop",
            (event) => {
                if (typeof event.keyCode !== 'number' ||
                    event.keyCode === 13)
                        this.onRangeChange(event.target.value, true);
        });
        channelStart.spinner("value", minMaxValues.start_val);

        // channel range slider
        let channelRange = $(this.element).find(".channel-slider");
        channelRange.slider({
            min: this.mode === CHANNEL_SETTINGS_MODE.FULL_RANGE ?
                    minMaxRange.start_min :
                    minMaxValues.start_val > minMaxValues.start_min ?
                    minMaxValues.start_min : minMaxValues.start_val,
            max: this.mode === CHANNEL_SETTINGS_MODE.FULL_RANGE ?
                    minMaxRange.end_max :
                    minMaxValues.end_val < minMaxValues.end_max ?
                    minMaxValues.end_max : minMaxValues.end_val,
            range: true,
            values: [minMaxValues.start_val, minMaxValues.end_val],
            change: (event, ui) => {
                // if slide update is pending => clear it
                if (this.lastUpdate) {
                    clearTimeout(this.lastUpdate);
                    this.lastUpdate = null;
                }
                this.onRangeChangeBoth(ui.values,
                    event.originalEvent ? true : false);
            }, slide: (event,ui) => {
                if (ui.values[0] >= ui.values[1]) return false;

                // adjust value in input fields instantly
                $(this.element).find(".channel-start").spinner(
                    "value", ui.values[0]);
                $(this.element).find(".channel-end").spinner(
                    "value", ui.values[1]);

                let imgConf = this.context.getSelectedImageConfig();
                if (imgConf.image_info.tiled) return true;

                // we want to update the histogram on slide so we
                // need a separate event. we throttle so that
                // we send only the last slider value within a 100ms window.
                this.lastDelayedTimeout = new Date().getTime();
                let delayedUpdate = (() => {
                    if (new Date().getTime() < this.lastDelayedTimeout)
                        return;
                    this.context.publish(
                        HISTOGRAM_RANGE_UPDATE,
                            {config_id : imgConf.id,
                                prop: 'start',
                                channel: this.index,
                                start: ui.values[0],
                                end: ui.values[1]});}).bind(this);
                this.lastUpdate = setTimeout(delayedUpdate, 100);
        }});
        channelRange.css("background", "white");
        // change slider background
        this.setBackgroundAfterColorChange(
            this.luts instanceof Map &&
               typeof this.luts.get(this.channel.color) === 'object');

        //channel end
        let channelEnd = $(this.element).find(".channel-end");
        channelEnd.spinner(
            {min: minMaxRange.end_min, max: minMaxRange.end_max});
        let channelEndArrows =
           $(channelEnd).parent().find('a.ui-spinner-button');
        channelEndArrows.css('display','none');
        channelEnd.on("blur",
            (event) => {
                channelEndArrows.css('display','none');
                this.onRangeChange(event.target.value, false, true);
            });
        channelEnd.on("focus",
            (event) => channelEndArrows.css('display','block'));
        channelEnd.on("blur",
            (event) => {
                $(channelEnd).find('a.ui-spinner-button').css(
                    'display','none');
                this.onRangeChange(event.target.value, false, true);
            });
        channelEnd.on("spinstop",
            (event) => {
                if (typeof event.keyCode !== 'number' ||
                    event.keyCode === 13)
                        this.onRangeChange(event.target.value)
        });
        channelEnd.spinner("value",minMaxValues.end_val);

        //channel color
        let isLut = imgConf.hasLookupTableEntry(this.channel.color);
        $(this.element).find(".spectrum-input").spectrum({
            color: isLut ? '#fff' : "#" + this.channel.color,
            showInput: true,
            containerClassName: 'color-range-spectrum-container',
            replacerClassName: 'color-range-replacer',
            showInitial: true,
            preferredFormat: "hex",
            appendTo: $(this.element).find('.channel-color'),
            change: (color) => this.onColorChange(color.toHexString())});
}

     /**
     * channel color change handler
     *
     * @param {number} value the new value
     * @memberof ChannelRange
     */
     onColorChange(value) {
         let imgConf = this.context.getSelectedImageConfig();
         let isLut = imgConf.hasLookupTableEntry(value);
         let oldValue = this.channel.color;
         this.channel.color = isLut ? value : value.substring(1);
         // change slider background
         this.setBackgroundAfterColorChange(isLut);
         $(this.element).find(".spectrum-input").spectrum(
             "set", isLut ? '#fff' : value);
         // add history record
         imgConf.addHistory({
             prop: ['image_info', 'channels', '' + this.index,'color'],
             old_val : oldValue, new_val: this.channel.color, type: 'string'});
     }

     /**
     * reverse intensity toggle, adds only history entry
     *
     * @memberof ChannelRange
     */
     onReverseIntensityToggle() {
         let value = this.channel.reverseIntensity;
         this.context.getSelectedImageConfig().addHistory({
             prop: ['image_info', 'channels', '' + this.index,'reverseIntensity'],
             old_val : !value, new_val: value, type: 'boolean'});
         this.updateUI();
     }

     /**
     * Chnages slider and button background after color/lut selection
     *
     * @param {boolean} ui_triggered was triggered by ui interaction
     * @private
     * @memberof ChannelRange
     */
     setBackgroundAfterColorChange(isLut) {
         let height = this.luts_png.height * 3;
         let blackGradientOffset = height - 29;
         let css = {
             "background-image" : "url('" + this.luts_png.url + "')",
             "background-size" : "100% " + height + "px",
             "background-repeat": "no-repeat",
             "background-position" : "0px -" + blackGradientOffset + "px",
             "transform":
                this.channel.reverseIntensity ? "scaleX(-1)" : "none",
             "background-color": ""
         };
         let resetCss = (transform_only=false) => {
             if (!transform_only) {
                 css['background-image'] = ""; css['background-size'] = "";
                 css['background-repeat'] = ""; css['background-position'] = "";
             };
             css['transform'] = "";
         };
         if (isLut) {
             let idx = this.luts.get(this.channel.color).index;
             if (idx >= 0) idx = idx * 30 + 1;
             else idx = blackGradientOffset;
             css['background-position'] = "0px -" + idx + "px";
             $(this.element).find(".channel-slider").find(
                 ".ui-slider-range").css(css);
             resetCss(idx !== blackGradientOffset);
             $(this.element).find(".channel").css(css);
         } else {
             css['background-color'] = "#" + this.channel.color;
             $(this.element).find(".channel-slider").find(
                 ".ui-slider-range").css(css);
             resetCss();
             $(this.element).find(".channel").css(css);
         }
     }

     /**
     * channel range change handler for changing start and end
     *
     * @param {Array.<number>} values the new value
     * @param {boolean} ui_triggered was triggered by ui interaction
     * @memberof ChannelRange
     */
     onRangeChangeBoth(values, ui_triggered=false) {
         if (!ui_triggered || !Misc.isArray(values)) return;

         let startManipulated =
            this.channel.window.start !== values[0];
         if (startManipulated) {
             if (values[0] >= values[1]) {
                 values[0] = values[1]-1;
             }
             this.onRangeChange(values[0], true);
         } else {
             if (values[1] <= values[0]) {
                 values[1] = values[0]+1;
             }
             this.onRangeChange(values[1], false);
         }
     }

     /**
     * channel range change handler
     *
     * @param {Array.<number>} value the new value
     * @param {boolean} is_start was start of range or not
     * @param {boolean} replace_empty_value if true we replace an empty string
     *                                      with the old value
     * @memberof ChannelRange
     */
    onRangeChange(value, is_start=false, replace_empty_value=false) {
        let clazz = is_start ? '.channel-start' : '.channel-end';
        let oldValue =
            is_start ? this.channel.window.start : this.channel.window.end;

        // some sanity checks
        if (typeof value !== 'number' && typeof value !== 'string') return;
        if (typeof value === 'string') {
            $(this.element).children("span").css(
                "border-color", "rgb(170,170,170)");
            // strip whitespace
            value = value.replace(/\s/g, "");
            if (value.length === 0 && replace_empty_value) {
                // we replace with the old value
                $(this.element).find(clazz).spinner("value", oldValue);
                return;
            }
            value = parseInt(value);
            if (isNaN(value)) {
                $(this.element).find(clazz).parent().css(
                    "border-color", "rgb(255,0,0)");
                return;
            }
        }

        // get appropriate min/max for start/end
        let minMaxRange =
            this.context.getSelectedImageConfig().
                image_info.getChannelMinMaxValues(
                    CHANNEL_SETTINGS_MODE.FULL_RANGE, this.index);
        let min = is_start ? minMaxRange.start_min : minMaxRange.end_min;
        let max = is_start ? minMaxRange.start_max : minMaxRange.end_max;
        let minMaxValues =
            this.context.getSelectedImageConfig().
                image_info.getChannelMinMaxValues(this.mode, this.index);
        let sliderMin = is_start ? minMaxValues.start_min : minMaxValues.end_min;
        let sliderMax = is_start ? minMaxValues.start_max : minMaxValues.end_max;

        // clamp
        let exceededBounds = false;
        if (value < min) {
            value = min;
            exceededBounds = true;
        }
        if (value > max) {
            value = max;
            exceededBounds = true;
        }
        // set new start/end
        if (!exceededBounds) {
            let otherClazz = is_start ? '.channel-end' : '.channel-start';
            $(this.element).children("span").css(
                "border-color", "rgb(170,170,170)");
            if ((is_start && value === this.channel.window.start) ||
                (!is_start && value === this.channel.window.end)) return;

            if (is_start) this.channel.window.start = value;
            else this.channel.window.end = value;

            try {
                $(this.element).find(clazz).spinner("value", value);
                $(this.element).find(".channel-slider").slider(
                    "option", "values",
                    [this.channel.window.start, this.channel.window.end]);

                if (is_start) {
                    $(this.element).find(otherClazz).spinner("option", "min", value+1);
                    $(this.element).find(".channel-slider").slider(
                        "option", "min", value < sliderMin ? value : sliderMin);
                } else {
                    $(this.element).find(otherClazz).spinner("option", "max", value-1);
                    $(this.element).find(".channel-slider").slider(
                        "option", "max",value > sliderMax ? value : sliderMax);
                }
                // add history record
                this.context.getSelectedImageConfig().addHistory({
                    prop:
                        ['image_info', 'channels', '' + this.index,
                        'window', is_start ? 'start' : 'end'],
                        old_val : oldValue, new_val: value, type : "number"});
                    } catch (ignored) {}
        } else $(this.element).find(clazz).parent().css(
            "border-color", "rgb(255,0,0)");
    }

    /**
     * Hides color picker
     *
     * @memberof ChannelRange
     */
    hideColorPicker() {
        $(this.element).find(".spectrum-input").spectrum("hide");
    }

    /**
     * Toggles a channel, i.e. sets it active or inactive
     *
     * @memberof ChannelRange
     */
    toggleChannel() {
        let imgConf = this.context.getSelectedImageConfig();

        // we don't allow to deactivate the only active channel for grayscale
        if (imgConf.image_info.model === 'greyscale' &&
            this.channel.active) return;

        let history = [];

        // toggle channel active state
        this.channel.active = !this.channel.active;
        // remember change
        history.push({
            prop: ['image_info', 'channels', '' + this.index, 'active'],
            old_val :   !this.channel.active,
            new_val: this.channel.active, type: 'boolean'});

        if (imgConf.image_info.model === 'greyscale') {
            // for grayscale: we allow only one active channel
            let channels = imgConf.image_info.channels;
            for (let i=0;i<channels.length;i++) {
                let c = channels[i];
                if (i === this.index || !c.active) continue;
                // deactivate other channels
                c.active = false;
                history.push({
                    prop: ['image_info', 'channels', '' + i, 'active'],
                    old_val : true, new_val: false, type: 'boolean'});
            };
        };
        imgConf.addHistory(history);
    }

    /**
     * Overridden aurelia lifecycle method:
     * called whenever the view is unbound within aurelia
     * in other words a 'destruction' hook that happens after 'detached'
     *
     * @memberof ChannelRange
     */
    unbind() {
        this.image_info = null;
    }
}
