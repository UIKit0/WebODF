/**
 * @license
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this code.  If not, see <http://www.gnu.org/licenses/>.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global runtime, core, gui, ops*/


/**
 * The caret manager is responsible for creating a caret as UI representation
 * of a member's cursor.
 * If the caret is for the local member, then the manager will control the
 * caret's current focus, and ensure the caret stays visible after every local
 * operation.
 * @constructor
 * @implements {core.Destroyable}
 * @param {!gui.SessionController} sessionController
 */
gui.CaretManager = function CaretManager(sessionController) {
    "use strict";
    var /**@type{!Object.<string,!gui.Caret>}*/
        carets = {},
        window = runtime.getWindow(),
        ensureCaretVisibleTimeoutId,
        scrollIntoViewScheduled = false;

    /**
     * @param {!string} memberId
     * @return {?gui.Caret}
     */
    function getCaret(memberId) {
        return carets.hasOwnProperty(memberId) ? carets[memberId] : null;
    }

    /**
     * @return {!Array.<!gui.Caret>}
     */
    function getCarets() {
        return Object.keys(carets).map(function (memberid) {
            return carets[memberid];
        });
    }

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    function removeCaret(memberId) {
        var caret = carets[memberId];
        if (caret) {
            /*jslint emptyblock:true*/
            caret.destroy(function() {});
            /*jslint emptyblock:false*/
            delete carets[memberId];
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function refreshLocalCaretBlinking(cursor) {
        var caret, memberId = cursor.getMemberId();

        if (memberId === sessionController.getInputMemberId()) {
            caret = getCaret(memberId);
            if (caret) {
                caret.refreshCursorBlinking();
            }
        }
    }

    function executeEnsureCaretVisible() {
        var caret = getCaret(sessionController.getInputMemberId());
        scrollIntoViewScheduled = false;
        if (caret) {
            // Just in case CaretManager was destroyed whilst waiting for the timeout to elapse
            caret.ensureVisible();
        }
    }

    function scheduleCaretVisibilityCheck() {
        var caret = getCaret(sessionController.getInputMemberId());
        if (caret) {
            caret.handleUpdate(); // This is really noticeable if delayed. Calculate the cursor size immediately
            if (!scrollIntoViewScheduled) {
                scrollIntoViewScheduled = true;
                // Delay the actual scrolling just in case there are a batch of
                // operations being performed. 50ms is close enough to "instant"
                // that the user won't notice the delay here.
                ensureCaretVisibleTimeoutId = runtime.setTimeout(executeEnsureCaretVisible, 50);
            }
        }
    }

    /**
     * @param {!{memberId:string}} info
     * @return {undefined}
     */
    function ensureLocalCaretVisible(info) {
        if (info.memberId === sessionController.getInputMemberId()) {
            // on member edit actions ensure visibility of cursor
            scheduleCaretVisibilityCheck();
        }
    }

    /**
     * @return {undefined}
     */
    function focusLocalCaret() {
        var caret = getCaret(sessionController.getInputMemberId());
        if (caret) {
            caret.setFocus();
        }
    }

    /**
     * @return {undefined}
     */
    function blurLocalCaret() {
        var caret = getCaret(sessionController.getInputMemberId());
        if (caret) {
            caret.removeFocus();
        }
    }

    /**
     * @return {undefined}
     */
    function showLocalCaret() {
        var caret = getCaret(sessionController.getInputMemberId());
        if (caret) {
            caret.show();
        }
    }

    /**
     * @return {undefined}
     */
    function hideLocalCaret() {
        var caret = getCaret(sessionController.getInputMemberId());
        if (caret) {
            caret.hide();
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @param {!boolean} caretAvatarInitiallyVisible  Set to false to hide the associated avatar
     * @param {!boolean} blinkOnRangeSelect  Specify that the caret should blink if a non-collapsed range is selected
     * @return {!gui.Caret}
     */
    this.registerCursor = function (cursor, caretAvatarInitiallyVisible, blinkOnRangeSelect) {
        var memberid = cursor.getMemberId(),
            caret = new gui.Caret(cursor, caretAvatarInitiallyVisible, blinkOnRangeSelect),
            eventManager = sessionController.getEventManager();

        carets[memberid] = caret;

        // if local input member, then let controller listen on caret span
        if (memberid === sessionController.getInputMemberId()) {
            runtime.log("Starting to track input on new cursor of " + memberid);

            // wire up the cursor update to caret visibility update
            cursor.subscribe(ops.OdtCursor.signalCursorUpdated, scheduleCaretVisibilityCheck);
            // Add event trap as an overlay element to the caret
            caret.setOverlayElement(eventManager.getEventTrap());
        } else {
            cursor.subscribe(ops.OdtCursor.signalCursorUpdated, caret.handleUpdate);
        }

        return caret;
    };

    /**
     * @param {!string} memberId
     * @return {?gui.Caret}
     */
    this.getCaret = getCaret;

    /**
     * @return {!Array.<!gui.Caret>}
     */
    this.getCarets = getCarets;

    /**
     * @param {!function(!Object=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
        var odtDocument = sessionController.getSession().getOdtDocument(),
            eventManager = sessionController.getEventManager(),
            caretCleanup = getCarets().map(function(caret) { return caret.destroy; });

        runtime.clearTimeout(ensureCaretVisibleTimeoutId);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphChanged, ensureLocalCaretVisible);
        odtDocument.unsubscribe(ops.Document.signalCursorMoved, refreshLocalCaretBlinking);
        odtDocument.unsubscribe(ops.Document.signalCursorRemoved, removeCaret);

        eventManager.unsubscribe("focus", focusLocalCaret);
        eventManager.unsubscribe("blur", blurLocalCaret);
        window.removeEventListener("focus", showLocalCaret, false);
        window.removeEventListener("blur", hideLocalCaret, false);

        carets = {};
        core.Async.destroyAll(caretCleanup, callback);
    };

    function init() {
        var odtDocument = sessionController.getSession().getOdtDocument(),
            eventManager = sessionController.getEventManager();

        odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, ensureLocalCaretVisible);
        odtDocument.subscribe(ops.Document.signalCursorMoved, refreshLocalCaretBlinking);
        odtDocument.subscribe(ops.Document.signalCursorRemoved, removeCaret);

        eventManager.subscribe("focus", focusLocalCaret);
        eventManager.subscribe("blur", blurLocalCaret);
        window.addEventListener("focus", showLocalCaret, false);
        window.addEventListener("blur", hideLocalCaret, false);
    }

    init();
};
