/*global Util*/

var AnchorPreview;

(function () {
    'use strict';

    AnchorPreview = function () {
        this.parent = true;
        this.name = 'anchor-preview';
    };

    AnchorPreview.prototype = {

        // the default selector to locate where to
        // put the activeAnchor value in the preview
        previewValueSelector: 'a',

        init: function (instance) {

            this.base = instance;
            this.anchorPreview = this.createPreview();
            this.base.options.elementsContainer.appendChild(this.anchorPreview);

            this.attachToEditables();
        },

        getPreviewElement: function () {
            return this.anchorPreview;
        },

        createPreview: function () {
            var el = this.base.options.ownerDocument.createElement('div');

            el.id = 'medium-editor-anchor-preview-' + this.base.id;
            el.className = 'medium-editor-anchor-preview';
            el.innerHTML = this.getTemplate();

            this.base.on(el, 'click', this.handleClick.bind(this));

            return el;
        },

        getTemplate: function () {
            return '<div class="medium-editor-toolbar-anchor-preview" id="medium-editor-toolbar-anchor-preview">' +
                '    <a class="medium-editor-toolbar-anchor-preview-inner"></a>' +
                '</div>';
        },

        deactivate: function () {
            if (this.anchorPreview) {
                if (this.anchorPreview.parentNode) {
                    this.anchorPreview.parentNode.removeChild(this.anchorPreview);
                }
                delete this.anchorPreview;
            }
        },

        hidePreview: function () {
            this.anchorPreview.classList.remove('medium-editor-anchor-preview-active');
            this.activeAnchor = null;
        },

        showPreview: function (anchorEl) {
            if (this.anchorPreview.classList.contains('medium-editor-anchor-preview-active') ||
                    anchorEl.getAttribute('data-disable-preview')) {
                return true;
            }

            if (this.previewValueSelector) {
                this.anchorPreview.querySelector(this.previewValueSelector).textContent = anchorEl.attributes.href.value;
                this.anchorPreview.querySelector(this.previewValueSelector).href = anchorEl.attributes.href.value;
            }

            this.anchorPreview.classList.add('medium-toolbar-arrow-over');
            this.anchorPreview.classList.remove('medium-toolbar-arrow-under');

            if (!this.anchorPreview.classList.contains('medium-editor-anchor-preview-active')) {
                this.anchorPreview.classList.add('medium-editor-anchor-preview-active');
            }

            this.activeAnchor = anchorEl;

            this.positionPreview();
            this.attachPreviewHandlers();

            return this;
        },

        positionPreview: function () {
            var buttonHeight = 40,
                boundary = this.activeAnchor.getBoundingClientRect(),
                middleBoundary = (boundary.left + boundary.right) / 2,
                halfOffsetWidth,
                defaultLeft;

            halfOffsetWidth = this.anchorPreview.offsetWidth / 2;
            defaultLeft = this.base.options.diffLeft - halfOffsetWidth;

            this.anchorPreview.style.top = Math.round(buttonHeight + boundary.bottom - this.base.options.diffTop + this.base.options.contentWindow.pageYOffset - this.anchorPreview.offsetHeight) + 'px';
            if (middleBoundary < halfOffsetWidth) {
                this.anchorPreview.style.left = defaultLeft + halfOffsetWidth + 'px';
            } else if ((this.base.options.contentWindow.innerWidth - middleBoundary) < halfOffsetWidth) {
                this.anchorPreview.style.left = this.base.options.contentWindow.innerWidth + defaultLeft - halfOffsetWidth + 'px';
            } else {
                this.anchorPreview.style.left = defaultLeft + middleBoundary + 'px';
            }
        },

        attachToEditables: function () {
            this.base.subscribe('editableMouseover', this.handleEditableMouseover.bind(this));
        },

        handleClick: function (event) {
            var anchorExtension = this.base.getExtensionByName('anchor'),
                activeAnchor = this.activeAnchor;

            if (anchorExtension && activeAnchor) {
                event.preventDefault();

                this.base.selectElement(this.activeAnchor);

                // Using setTimeout + options.delay because:
                // We may actually be displaying the anchor form, which should be controlled by options.delay
                this.base.delay(function () {
                    if (activeAnchor) {
                        anchorExtension.showForm(activeAnchor.attributes.href.value);
                        activeAnchor = null;
                    }
                }.bind(this));
            }

            this.hidePreview();
        },

        handleAnchorMouseout: function () {
            this.anchorToPreview = null;
            this.base.off(this.activeAnchor, 'mouseout', this.instanceHandleAnchorMouseout);
            this.instanceHandleAnchorMouseout = null;
        },

        handleEditableMouseover: function (event) {
            var target = Util.getClosestTag(event.target, 'a');

            if (target) {

                // Detect empty href attributes
                // The browser will make href="" or href="#top"
                // into absolute urls when accessed as event.targed.href, so check the html
                if (!/href=["']\S+["']/.test(target.outerHTML) || /href=["']#\S+["']/.test(target.outerHTML)) {
                    return true;
                }

                // only show when hovering on anchors
                if (this.base.toolbar && this.base.toolbar.isDisplayed()) {
                    // only show when toolbar is not present
                    return true;
                }

                // detach handler for other anchor in case we hovered multiple anchors quickly
                if (this.activeAnchor && this.activeAnchor !== target) {
                    this.detachPreviewHandlers();
                }

                this.anchorToPreview = target;

                this.instanceHandleAnchorMouseout = this.handleAnchorMouseout.bind(this);
                this.base.on(this.anchorToPreview, 'mouseout', this.instanceHandleAnchorMouseout);
                // Using setTimeout + options.delay because:
                // - We're going to show the anchor preview according to the configured delay
                //   if the mouse has not left the anchor tag in that time
                this.base.delay(function () {
                    if (this.anchorToPreview) {
                        //this.activeAnchor = this.anchorToPreview;
                        this.showPreview(this.anchorToPreview);
                    }
                }.bind(this));
            }
        },

        handlePreviewMouseover: function () {
            this.lastOver = (new Date()).getTime();
            this.hovering = true;
        },

        handlePreviewMouseout: function (event) {
            if (!event.relatedTarget || !/anchor-preview/.test(event.relatedTarget.className)) {
                this.hovering = false;
            }
        },

        updatePreview: function () {
            if (this.hovering) {
                return true;
            }
            var durr = (new Date()).getTime() - this.lastOver;
            if (durr > this.base.options.anchorPreviewHideDelay) {
                // hide the preview 1/2 second after mouse leaves the link
                this.detachPreviewHandlers();
            }
        },

        detachPreviewHandlers: function () {
            // cleanup
            clearInterval(this.intervalTimer);
            if (this.instanceHandlePreviewMouseover) {
                this.base.off(this.anchorPreview, 'mouseover', this.instanceHandlePreviewMouseover);
                this.base.off(this.anchorPreview, 'mouseout', this.instanceHandlePreviewMouseout);
                if (this.activeAnchor) {
                    this.base.off(this.activeAnchor, 'mouseover', this.instanceHandlePreviewMouseover);
                    this.base.off(this.activeAnchor, 'mouseout', this.instanceHandlePreviewMouseout);
                }
            }

            this.hidePreview();

            this.hovering = this.instanceHandlePreviewMouseover = this.instanceHandlePreviewMouseout = null;
        },

        // TODO: break up method and extract out handlers
        attachPreviewHandlers: function () {
            this.lastOver = (new Date()).getTime();
            this.hovering = true;

            this.instanceHandlePreviewMouseover = this.handlePreviewMouseover.bind(this);
            this.instanceHandlePreviewMouseout = this.handlePreviewMouseout.bind(this);

            this.intervalTimer = setInterval(this.updatePreview.bind(this), 200);

            this.base.on(this.anchorPreview, 'mouseover', this.instanceHandlePreviewMouseover);
            this.base.on(this.anchorPreview, 'mouseout', this.instanceHandlePreviewMouseout);
            this.base.on(this.activeAnchor, 'mouseover', this.instanceHandlePreviewMouseover);
            this.base.on(this.activeAnchor, 'mouseout', this.instanceHandlePreviewMouseout);
        }
    };
}());
