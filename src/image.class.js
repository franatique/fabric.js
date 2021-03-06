(function(global) {

  "use strict";

  var extend = fabric.util.object.extend;

  if (!global.fabric) {
    global.fabric = { };
  }

  if (global.fabric.Image) {
    fabric.warn('fabric.Image is already defined.');
    return;
  }

  /**
   * @class Image
   * @extends fabric.Object
   */
  fabric.Image = fabric.util.createClass(fabric.Object, /** @scope fabric.Image.prototype */ {

    /**
     * @property
     * @type Boolean
     */
    active: false,

    /**
     * @property
     * @type String
     */
    type: 'image',

    /**
     * @property
     * @type String
     */
    preserveAspectRatio: 'xMidYMid',

    /**
     * @property
     * @type Object
     */
    clipPath: null,


    /**
     * Constructor
     * @param {HTMLImageElement | String} element Image element
     * @param {Object} options optional
     */
    initialize: function(element, options) {
      options || (options = { });

      this.callSuper('initialize', options);
      this._initElement(element);
      this._originalImage = this.getElement();
      this._initConfig(options);

      this.filters = [ ];

      if (options.filters) {
        this.filters = options.filters;
        this.applyFilters();
      }
    },

    /**
     * Returns image element which this instance if based on
     * @method getElement
     * @return {HTMLImageElement} image element
     */
    getElement: function() {
      return this._element;
    },

    /**
     * Sets image element for this instance to a specified one
     * @method setElement
     * @param {HTMLImageElement} element
     * @return {fabric.Image} thisArg
     * @chainable
     */
    setElement: function(element) {
      this._element = element;
      this._initConfig();
      return this;
    },

    /**
     * Sets clip path for this instance to a specified one
     * @method setClipPath
     * @param {fabric.Object} element
     */
    setClipPath: function(element) {
        this.clipPath = element;
    },

    /**
     * Returns original size of an image
     * @method getOriginalSize
     * @return {Object} object with "width" and "height" properties
     */
    getOriginalSize: function() {
      var element = this.getElement();
      return {
        width: element.width,
        height: element.height
      };
    },

    /**
     * Renders image on a specified context
     * @method render
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    render: function(ctx, noTransform) {
      ctx.save();
      var m = this.transformMatrix;
      this._preserveAspectRatio();
      if (this.group) {
        ctx.translate(-this.group.width/2 + this.width/2 + this.left, -this.group.height/2 + this.height/2 + this.top);
      }
      if (m) {
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      }

      if (!noTransform) {
        this.transform(ctx);
      }
        if(this.clipPath){
            this.clipPath.render(ctx);
            ctx.clip();
        }

      this._render(ctx);
      if (this.active && !noTransform) {
        this.drawBorders(ctx);
        this.hideCorners || this.drawCorners(ctx);
      }
      ctx.restore();
    },

    /**
     * Returns object representation of an instance
     * @method toObject
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        src: this._originalImage.src || this._originalImage._src,
        filters: this.filters.concat()
      });
    },

    /**
     * Returns svg representation of an instance
     * @method toSVG
     * @return {string} svg representation of an instance
     */
    toSVG: function() {
      return '<g transform="' + this.getSvgTransform() + '">'+
                '<image xlink:href="' + this.getSvgSrc() + '" '+
                  'style="' + this.getSvgStyles() + '" ' +
                  // we're essentially moving origin of transformation from top/left corner to the center of the shape
                  // by wrapping it in container <g> element with actual transformation, then offsetting object to the top/left
                  // so that object's center aligns with container's left/top
                  'transform="translate('+ (-this.width/2) + ' ' + (-this.height/2) + ')" ' +
                  'width="' + this.width + '" ' +
                  'height="' + this.height + '"' + '/>'+
              '</g>';
    },

    /**
     * Returns source of an image
     * @method getSrc
     * @return {String} Source of an image
     */
    getSrc: function() {
      return this.getElement().src || this.getElement()._src;
    },

    /**
     * Returns string representation of an instance
     * @method toString
     * @return {String} String representation of an instance
     */
    toString: function() {
      return '#<fabric.Image: { src: "' + this.getSrc() + '" }>';
    },

    /**
     * Returns a clone of an instance
     * @mthod clone
     * @param {Function} callback Callback is invoked with a clone as a first argument
     */
    clone: function(callback) {
      this.constructor.fromObject(this.toObject(), callback);
    },

    /**
     * Applies filters assigned to this image (from "filters" array)
     * @mthod applyFilters
     * @param {Function} callback Callback is invoked when all filters have been applied and new image is generated
     */
    applyFilters: function(callback) {

      if (this.filters.length === 0) {
        this.setElement(this._originalImage);
        callback && callback();
        return;
      }

      var isLikelyNode = typeof Buffer !== 'undefined' && typeof window === 'undefined',
          imgEl = this._originalImage,
          canvasEl = fabric.document.createElement('canvas'),
          replacement = isLikelyNode ? new (require('canvas').Image)() : fabric.document.createElement('img'),
          _this = this;

        if (!canvasEl.getContext && typeof G_vmlCanvasManager !== 'undefined') {
          G_vmlCanvasManager.initElement(canvasEl);
        }

      canvasEl.width = imgEl.width;
      canvasEl.height = imgEl.height;

      canvasEl.getContext('2d').drawImage(imgEl, 0, 0, imgEl.width, imgEl.height);

      this.filters.forEach(function(filter) {
        filter && filter.applyTo(canvasEl);
      });

       /** @ignore */
      replacement.onload = function() {
        _this._element = replacement;
        callback && callback();
        replacement.onload = canvasEl = imgEl = null;
      };
      replacement.width = imgEl.width;
      replacement.height = imgEl.height;

      if (isLikelyNode) {
        var base64str = canvasEl.toDataURL('image/png').replace(/data:image\/png;base64,/, '');
        replacement.src = new Buffer(base64str, 'base64');
        _this._element = replacement;

        // onload doesn't fire in node, so we invoke callback manually
        callback && callback();
      }
      else {
        replacement.src = canvasEl.toDataURL('image/png');
      }

      return this;
    },

    /**
     * @private
     * @method _render
     */
    _render: function(ctx) {
      ctx.drawImage(
        this.getElement(),
        - this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
    },

    /**
     * @private
     * @method _resetWidthHeight
     */
    _resetWidthHeight: function() {
      var element = this.getElement();

      this.set('width', element.width);
      this.set('height', element.height);
    },

    /**
     * @private
     * @method _preserveAspectRatio
     * @see http://www.w3.org/TR/SVG/coords.html#PreserveAspectRatioAttribute
     */
    _preserveAspectRatio: function() {
        var element = this.getElement(),
            desiredWidth = this.get('width'),
            desiredHeight = this.get('height');

        if(this.preserveAspectRatio.indexOf('none') > -1){
            this.set('width', desiredWidth);
            this.set('height', desiredHeight);
            return;
        }

        var scale = 1;
        if(desiredHeight > desiredWidth){
            scale = desiredWidth / element.width;
        } else {
            scale = desiredHeight / element.height;
        }
        this.set('width', element.width * scale);
        this.set('height', element.height * scale);

        var posX = this.preserveAspectRatio.substr(0,4),
            posY = this.preserveAspectRatio.substr(4,4);
        switch(posX){
            case "xMin":
                //this.set('left', this.left);
                break;
            case "xMid":
                this.set('left', this.left + (desiredWidth - this.width)/2);
                break;
            case "xMax":
                this.set('left', this.left + desiredWidth - this.width);
                break;
        };

        switch(posY){
            case "YMin":
                //this.set('top', this.top );
                break;
            case "YMid":
                this.set('top', this.top + (desiredHeight - this.height)/2);
                break;
            case "YMax":
                this.set('top', this.top + desiredHeight - this.height);
                break;
        }
    },

    /**
     * The Image class's initialization method. This method is automatically
     * called by the constructor.
     * @private
     * @method _initElement
     * @param {HTMLImageElement|String} el The element representing the image
     */
    _initElement: function(element) {
      this.setElement(fabric.util.getById(element));
      fabric.util.addClass(this.getElement(), fabric.Image.CSS_CANVAS);
    },

    /**
     * @private
     * @method _initConfig
     * @param {Object} options Options object
     */
    _initConfig: function(options) {
      options || (options = { });
      this.setOptions(options);
      this._setWidthHeight(options);
      this._setPreserveAspectRatio(options);
    },

    /**
     * @private
     * @method _initFilters
     * @param {Object} object Object with filters property
     */
    _initFilters: function(object) {
      if (object.filters && object.filters.length) {
        this.filters = object.filters.map(function(filterObj) {
          return filterObj && fabric.Image.filters[filterObj.type].fromObject(filterObj);
        });
      }
    },

    /**
     * @private
     * @method _setWidthHeight
     * @param {Object} options Object with width/height properties
     */
    _setWidthHeight: function(options) {
      this.width = 'width' in options
        ? options.width
        : (this.getElement().width || 0);

      this.height = 'height' in options
        ? options.height
        : (this.getElement().height || 0);
    },

    /**
     * @private
     * @method _setPreserveAspectRatio
     * @param {Object} options Object with preserveAspectRatio property
     */
    _setPreserveAspectRatio: function(options) {
        this.preserveAspectRatio = 'preserveAspectRatio' in options
            ? options.preserveAspectRatio
            : 'xMidYMid';
        },



    /**
     * Returns complexity of an instance
     * @method complexity
     * @return {Number} complexity
     */
    complexity: function() {
      return 1;
    }
  });

  /**
   * Default CSS class name for canvas
   * @static
   * @type String
   */
  fabric.Image.CSS_CANVAS = "canvas-img";

  fabric.Image.prototype.getSvgSrc = fabric.Image.prototype.getSrc;

  /**
   * Creates an instance of fabric.Image from its object representation
   * @static
   * @method fromObject
   * @param object {Object}
   * @param callback {Function} optional
   */
  fabric.Image.fromObject = function(object, callback) {
    var img = fabric.document.createElement('img'),
        src = object.src;

    if (object.width) {
      img.width = object.width;
    }
    if (object.height) {
      img.height = object.height;
    }

    /** @ignore */
    img.onload = function() {
      fabric.Image.prototype._initFilters.call(object, object);

      var instance = new fabric.Image(img, object);
      callback && callback(instance);
      img = img.onload = null;
    };
    img.src = src;
  };

  /**
   * Creates an instance of fabric.Image from an URL string
   * @static
   * @method fromURL
   * @param {String} url URL to create an image from
   * @param {Function} [callback] Callback to invoke when image is created (newly created image is passed as a first argument)
   * @param {Object} [imgOptions] Options object
   */
  fabric.Image.fromURL = function(url, callback, imgOptions) {
    var img = fabric.document.createElement('img');

    /** @ignore */
    img.onload = function() {
      if (callback) {
        callback(new fabric.Image(img, imgOptions));
      }
      img = img.onload = null;
    };
    img.src = url;
  };

  /**
   * List of attribute names to account for when parsing SVG element (used by {@link fabric.Image.fromElement})
   * @static
   * @see http://www.w3.org/TR/SVG/struct.html#ImageElement
   */
  fabric.Image.ATTRIBUTE_NAMES = 'x y width height fill fill-opacity opacity stroke stroke-width transform xlink:href preserveAspectRatio'.split(' ');

  /**
   * Returns {@link fabric.Image} instance from an SVG element
   * @static
   * @method fabric.Image.fromElement
   * @param {SVGElement} element Element to parse
   * @param {Function} callback Callback to execute when fabric.Image object is created
   * @param {Object} [options] Options object
   * @return {fabric.Image}
   */
  fabric.Image.fromElement = function(element, callback, options) {
    options || (options = { });

    var parsedAttributes = fabric.parseAttributes(element, fabric.Image.ATTRIBUTE_NAMES);

    fabric.Image.fromURL(parsedAttributes['xlink:href'], callback, parsedAttributes);
  };

  fabric.Image.async = true;

})(typeof exports !== 'undefined' ? exports : this);
