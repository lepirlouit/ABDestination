// ==UserScript==
// @name        ABDestination
// @namespace   fr.kergoz-panic.watilin
// @description Choisissez une destination et ce script vous dira quelle direction prendre et quand vous arriverez.
// @version     2.0
//
// @author      Watilin
// @license     GPLv2; http://www.gnu.org/licenses/old-licenses/gpl-2.0.txt
// @supportURL  https://github.com/Watilin/ABDestination/issues
//
// @downloadURL https://raw.githubusercontent.com/Watilin/Pupil-Manager/master/ABDestination.user.js
// @updateURL   https://raw.githubusercontent.com/Watilin/Pupil-Manager/master/ABDestination.meta.js
//
// @include     http://www.alphabounce.com/
// @include     http://www.alphabounce.com/user/*
// @nocompat
//
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_getResourceText
//
// @resource    ui-html             ./ui.html?v=2.0
// @resource    ui-css              ./ui.css?v=2.0
// ==/UserScript==

"use strict";

// Note: this userscript is Firefox only.

// Table of Contents
//  [SHI] Shims for Retarded Browsers
//  [CON] Script Constants
//  [MAI] Main Script Section
//  [UIM] UI Managment
//  [ANI] Animation
//  [UTI] Utils

// [@SHI] Shims for Retarded Browsers //////////////////////////////////

[ "slice", "forEach", "map", "filter", "some", "every", "reduce" ]
  .forEach(function (methodName) {
    if (!(methodName in Array)) {
      Array[methodName] = function (iterable, callback, context) {
        return Array.prototype[methodName]
          .call(iterable, callback, context);
      };
    }
  });

if (!("contains" in String.prototype)) {
  String.prototype.contains = function contains(sub) {
    return this.indexOf(sub) >= 0;
  };
}

// [@CON] Script Constants /////////////////////////////////////////////

const π = Math.PI;
const ANIM_DURATION = 1200; // ms
const WORMHOLE_THRESHOLD = 4000; // ms
const FREE_FUEL = 3; // not intended to remain constant

// [@MAI] Main Script Section //////////////////////////////////////////

function runTopWindow() {
  var iw = document.getElementById("iframe").contentWindow;

  // hacking haxe.Http to retrieve player's coordinates
  // this avoids making an unnecessary request to the server
  var proto = unsafeWindow.haxe.Http.prototype;
  proxifyFunction(proto, "request", function () {
    if (!this.url.startsWith("/user/data.xml")) return;

    proxifyFunction(this, "onData", function (str) {
      var engineChanged = false;
      var coordsChanged = false;

      var engineMatch = /\bengine="(\d+)"/.exec(str);
      if (engineMatch) {
        var oldEngine = GM_getValue("engine", 1);
        var engine = parseInt(engineMatch[1], 10);
        engineChanged = oldEngine !== engine;
        GM_setValue("engine", engine);
      }

      var xMatch = /\bx="(-?\d+)"/.exec(str);
      var yMatch = /\by="(-?\d+)"/.exec(str);
      if (xMatch && yMatch) {
        var oldX = GM_getValue("x", 0);
        var oldY = GM_getValue("y", 0);
        var x = parseInt(xMatch[1], 10);
        var y = parseInt(yMatch[1], 10);
        coordsChanged = (oldX !== x) || (oldY !== y);
        GM_setValue("x", x);
        GM_setValue("y", y);
      }

      // sending one event for one or both changes
      if (engineChanged || coordsChanged) {
        document.getElementById("iframe").contentWindow
          .dispatchEvent(new CustomEvent("gameDataChanged"));
      }
    });
  });
}

function runIframe() {
  var $menuUl = document.querySelector("#menu ul");

  var $newLi = document.createElement("li");
  var $oldLi = $menuUl.querySelector(".active");
  var $ui;
  var $section = document.getElementById("section");

  var $a = document.createElement("a");
  $a.textContent = "Destination";
  $a.href = "/user/destination";

  $a.addEventListener("click", function (event) {
    event.preventDefault();
    if ($newLi.classList.contains("active")) return;

    if (!$ui) {
      var fragment = injectUI();
      $ui = fragment.querySelector("#section");
      $section.parentNode.insertBefore(fragment, $section.nextSibling);
    }
    $ui.style.display = "";
    $section.style.display = "none";
    $oldLi.classList.remove("active");
    $newLi.classList.add("active");
    requestAnimationFrame(updateUI);
  });

  $oldLi.querySelector("a").addEventListener("click", function (event) {
    if (!$newLi.classList.contains("active")) return;

    event.preventDefault();
    $ui.style.display = "none";
    $section.style.display = "";
    $oldLi.classList.add("active");
    $newLi.classList.remove("active");
  });

  $newLi.appendChild($a);
  $menuUl.appendChild($newLi);
}

if (self === top && "/" === location.pathname) { // top-level window
  runTopWindow();
} else if ("/" === parent.location.pathname &&
           location.pathname.startsWith("/user/")) { // iframe
  runIframe();
}

// [@UIM] UI Managment /////////////////////////////////////////////////

var injectUI, updateUI;
(function () {
  var $coordX, $coordY,
      $engine,
      $destX, $destY,
      $distH, $distV, $distTot,
      $trip,
      $cape;

  var paintStyles = {};

  injectUI = function injectUI() {
    var fragment = document.createDocumentFragment();
    var $container = document.createElement("div");

    var uiHtml = GM_getResourceText("ui-html");
    var uiCss  = GM_getResourceText("ui-css");

    var $style = document.createElement("style");
    $style.type = "text/css";
    $style.media = "screen";
    $style.textContent = uiCss;
    document.head.appendChild($style);

    var sheet = $style.sheet;
    Array.forEach(sheet.cssRules, function (rule) {
      if (rule.selectorText.startsWith("#cape .")) {
        paintStyles[rule.selectorText] = rule.style;
      }
    });

    window.addEventListener("gameDataChanged", function () {
      requestAnimationFrame(updateUI);
    });

    $container.innerHTML = uiHtml;
    $coordX  = $container.querySelector("#coord-x");
    $coordY  = $container.querySelector("#coord-y");
    $engine  = $container.querySelector("#engine");
    $destX   = $container.querySelector("#dest-x");
    $destY   = $container.querySelector("#dest-y");
    $distH   = $container.querySelector("#dist-h");
    $distV   = $container.querySelector("#dist-v");
    $distTot = $container.querySelector("#dist-tot");
    $trip    = $container.querySelector("#trip");
    $cape    = $container.querySelector("#cape");

    var timerId;
    var destinationChange = function (event) {
      clearTimeout(timerId);
      timerId = setTimeout(function () {
        GM_setValue("destinationX", $destX.value);
        GM_setValue("destinationY", $destY.value);
        updateUI();
      }, 200);
    };

    $destX.addEventListener("change", destinationChange);
    $destX.addEventListener("keyup", destinationChange);
    $destY.addEventListener("change", destinationChange);
    $destY.addEventListener("keyup", destinationChange);

    var cx = $cape.getContext("2d");
    cx.translate($cape.width / 2, $cape.height / 2);

    while ($container.firstChild) {
      fragment.appendChild($container.firstChild);
    }
    return fragment;
  };

  updateUI = function updateUI() {
    var x      = parseInt(GM_getValue("x",            0), 10);
    var y      = parseInt(GM_getValue("y",            0), 10);
    var engine = parseInt(GM_getValue("engine",       1), 10);
    var destX  = parseInt(GM_getValue("destinationX", 0), 10);
    var destY  = parseInt(GM_getValue("destinationY", 0), 10);

    $coordX.textContent = x;
    $coordY.textContent = y;
    $engine.textContent = engine;

    /* Do not use `!==` here. Let the type coercion do its job-- this is
      for Chrome which sees no problem with inputs of type number having
      values of type string.
    */
    if (destX != $destX.value) $destX.value = destX;
    if (destY != $destY.value) $destY.value = destY;

    var distH = destX - x;
    var distV = destY - y;
    var absDistH = Math.abs(distH);
    var absDistV = Math.abs(distV);
    var distTot = absDistH + absDistV;

    $distH.textContent = absDistH;
    $distV.textContent = absDistV;
    $distTot.textContent = distTot;

    var days = Math.ceil(distTot / (engine * FREE_FUEL));
    $trip.textContent = days + (days >= 2 ? "\xA0jours" : "\xA0jour");

    var angle = Math.atan(distV / distH);
    if (distH < 0) angle += π;

    animateAngleChange(angle, $cape, paintStyles);
  };
}());

// [@ANI] Animation ////////////////////////////////////////////////////

var animateAngleChange = (function () {
  var previousAngle = 0;
  var currentAngle = 0;
  var reqId;

  return function animateAngleChange(newAngle, $cvs, paintStyles) {
    cancelAnimationFrame(reqId);
    previousAngle = currentAngle || 0;

    var angleDiff = newAngle - previousAngle;
    if (Math.abs(angleDiff) > π) {
      angleDiff -= Math.sign(angleDiff) * 2*π;
    }

    var firstFrameTime = Date.now();
    var lastFrameTime = Date.now();

    var ease = easeOutCubic;

    (function drawNextFrame() {
      var now = Date.now();

      var t = now - firstFrameTime;
      if (t <= ANIM_DURATION) {
        reqId = requestAnimationFrame(drawNextFrame);
      }

      // prevents “wormhole” effect
      if (now - lastFrameTime > WORMHOLE_THRESHOLD) return;
      lastFrameTime = now;

      var angle = previousAngle + ease(t/ANIM_DURATION) * angleDiff;
      currentAngle = angle;
      draw($cvs, angle, paintStyles);
    }());
  }
}());

function easeOutCubic(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  var p = x - 1;
  return p*p*p + 1;
}

function draw($cvs, θ, paintStyles) {
  var cx = $cvs.getContext("2d");
  var w = $cvs.width;
  var h = $cvs.height;
  var r = Math.min(w, h) / 2;

  var cos = Math.cos.bind(Math);
  var sin = Math.sin.bind(Math);

  cx.clearRect(-w/2, -h/2, w, h);

  // draws the background grid
  cx.fillStyle   = paintStyles["#cape .grid"].backgroundColor;
  cx.fillRect(-w/2, -h/2, w, h);
  cx.strokeStyle = paintStyles["#cape .grid"].color;
  cx.lineWidth = 1;
  var gridOffsetX = Math.round(20 * Math.SQRT1_2 * cos(θ)) - 0.5;
  var gridOffsetY = Math.round(20 * Math.SQRT1_2 * sin(θ)) - 0.5;
  cx.beginPath();
  for (var gridX = -w/2 - gridOffsetX; gridX < w/2; gridX += 20) {
    cx.moveTo(gridX, -h/2);
    cx.lineTo(gridX, +h/2);
  }
  for (var gridY = -h/2 - gridOffsetY; gridY < h/2; gridY += 20) {
    cx.moveTo(-w/2, gridY);
    cx.lineTo(+w/2, gridY);
  }
  cx.stroke();

  var ρ = w*2;
  var a = Math.round(ρ*0.9 * cos(θ+π)) - 0.5;
  var b = Math.round(ρ*0.9 * sin(θ+π)) - 0.5;

  // draws the vernier-like scale
  var scale = 1/60;
  var dash = 2*π * ρ * scale;
  cx.setLineDash([1, dash-1]);
  cx.lineWidth = 20;
  cx.strokeStyle = paintStyles["#cape .vernier"].color;
  cx.beginPath();
  cx.arc(a, b, ρ, θ*3, θ*3 + 2*π);
  cx.stroke();

  // draws the compass scale
  cx.lineCap = "butt";
  cx.strokeStyle = paintStyles["#cape .compass"].color;

  var compassRadius = r-5;
  dash = 2*π * compassRadius / 16;
  cx.lineWidth = 5;
  cx.setLineDash([1, dash-1]);
  cx.lineDashOffset = 0.5;
  cx.beginPath();
  cx.arc(-0.5, -0.5, compassRadius, 0, 2*π);
  cx.stroke();

  compassRadius = r-8;
  dash = 2*π * compassRadius / 4;
  cx.lineWidth = 8;
  cx.setLineDash([1, dash-1]);
  cx.beginPath();
  cx.arc(-0.5, -0.5, compassRadius, 0, 2*π);
  cx.stroke();

  cx.lineDashOffset = 0;
  cx.setLineDash([]);

  // traçage de la flèche
  /*                      H
     F____________________|\
      \                   G \
       \E                    \A
       /                     /
      /___________________C /
     D                    |/
                          B
  */
  var arrowRadius = r-4;
  cx.lineWidth = 1.5;
  cx.beginPath();
  cx.moveTo(-0.5 + Math.round(     arrowRadius * cos(θ)),
            -0.5 + Math.round(     arrowRadius * sin(θ))); // A
  cx.lineTo(-0.5 + Math.round(0.5 *arrowRadius * cos(θ + 0.6)),
            -0.5 + Math.round(0.5 *arrowRadius * sin(θ + 0.6))); // B
  cx.lineTo(-0.5 + Math.round(0.5 *arrowRadius * cos(θ + 0.09)),
            -0.5 + Math.round(0.5 *arrowRadius * sin(θ + 0.09))); // C
  cx.lineTo(-0.5 + Math.round(0.96*arrowRadius * cos(θ + π - 0.15)),
            -0.5 + Math.round(0.96*arrowRadius * sin(θ + π - 0.15))); // D
  cx.lineTo(-0.5 + Math.round(0.9 *arrowRadius * cos(θ + π)),
            -0.5 + Math.round(0.9 *arrowRadius * sin(θ + π))); // E
  cx.lineTo(-0.5 + Math.round(0.96*arrowRadius * cos(θ + π + 0.15)),
            -0.5 + Math.round(0.96*arrowRadius * sin(θ + π + 0.15))); // F
  cx.lineTo(-0.5 + Math.round(0.5 *arrowRadius * cos(θ - 0.09)),
            -0.5 + Math.round(0.5 *arrowRadius * sin(θ - 0.09))); // G
  cx.lineTo(-0.5 + Math.round(0.5 *arrowRadius * cos(θ - 0.6)),
            -0.5 + Math.round(0.5 *arrowRadius * sin(θ - 0.6))); // H
  cx.closePath();
  cx.strokeStyle = paintStyles["#cape .arrow"].color;
  cx.fillStyle   = paintStyles["#cape .arrow"].backgroundColor;
  cx.stroke();
  cx.fill();
}

// [@UTI] Utils ////////////////////////////////////////////////////////

function proxifyFunction(targetScope, funcName, action) {
  targetScope = targetScope.wrappedJSObject || targetScope;

  var desc = Object.getOwnPropertyDescriptor(targetScope, funcName);
  if (!desc.configurable) {
    throw new Error("Cannot proxify non configurable function");
  }

  var backup = exportFunction(targetScope[funcName],
                              targetScope,
                              { allowCrossOriginArguments: true });
  exportFunction(function () {
    if (action) action.apply(this, arguments);
    return backup.apply(this, arguments);
  }, targetScope, { defineAs: funcName });
}
