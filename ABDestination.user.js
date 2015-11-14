// ==UserScript==
// @name        ABDestination
// @namespace   fr.kergoz-panic.watilin
// @description Choisissez une destination et ce script vous dira quelle direction prendre et quand vous arriverez.
// @version     2.1
//
// @author      Watilin
// @license     GPLv2; http://www.gnu.org/licenses/old-licenses/gpl-2.0.txt
// @supportURL  https://github.com/Watilin/ABDestination/issues
//
// @downloadURL https://raw.githubusercontent.com/Watilin/ABDestination/master/ABDestination.user.js
// @updateURL   https://raw.githubusercontent.com/Watilin/ABDestination/master/ABDestination.meta.js
//
// @include     http://www.alphabounce.com/
// @include     http://www.alphabounce.com/user/*
// @nocompat
//
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_getResourceText
//
// @resource    ui-html             ui.html?v=2.1
// @resource    ui-css              ui.css?v=2.1
// ==/UserScript==

"use strict";

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
      $engine, $move, $accel,
      $radar, $sight,
      $destX, $destY,
      $distH, $distV, $distTot,
      $fuel,
      $gamesE, $daysE, $gamesU, $daysU,
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
    $move    = $container.querySelector("#move-range");
    $accel   = $container.querySelector("#accel");
    $radar   = $container.querySelector("#radar");
    $sight   = $container.querySelector("#sight-range");
    $destX   = $container.querySelector("#dest-x");
    $destY   = $container.querySelector("#dest-y");
    $distH   = $container.querySelector("#dist-h");
    $distV   = $container.querySelector("#dist-v");
    $distTot = $container.querySelector("#dist-tot");
    $fuel    = $container.querySelector("#fuel");
    $gamesE  = $container.querySelector("#games-explored");
    $daysE   = $container.querySelector("#days-explored");
    $gamesU  = $container.querySelector("#games-unseen");
    $daysU   = $container.querySelector("#days-unseen");
    $cape    = $container.querySelector("#cape");

    // uncomment following console.log when testing with Chrome
    // $accel.addEventListener("click", console.log.bind(console));
    $accel.addEventListener("change", function (event) {
      GM_setValue("hasAccelerator", this.checked);
      updateUI();
    });

    var radarChange = function (event) {
      var oldRadar = GM_getValue("radar");
      var newRadar = parseInt($radar.value, 10) || 0;
      if (newRadar !== oldRadar) {
        GM_setValue("radar", newRadar);
        updateUI();
      }
    };
    $radar.addEventListener("change", radarChange);
    $radar.addEventListener("keyup", radarChange);

    var timerId;
    var destinationChange = function (event) {
      clearTimeout(timerId);
      timerId = setTimeout(function () {
        var oldX = GM_getValue("destinationX");
        var oldY = GM_getValue("destinationY");
        var newX = parseInt($destX.value, 10) || 0;
        var newY = parseInt($destY.value, 10) || 0;
        if (newX !== oldX || newY !== oldY) {
          GM_setValue("destinationX", parseInt($destX.value, 10) || 0);
          GM_setValue("destinationY", parseInt($destY.value, 10) || 0);
          updateUI();
        }
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
    var x      = GM_getValue("x"           , 0);
    var y      = GM_getValue("y"           , 0);
    var engine = GM_getValue("engine"      , 1);
    var radar  = GM_getValue("radar"       , 0);
    var destX  = GM_getValue("destinationX", 0);
    var destY  = GM_getValue("destinationY", 0);
    var hasAccel = GM_getValue("hasAccelerator", false);

    $coordX.textContent = x;
    $coordY.textContent = y;
    $engine.textContent = engine - 1;
    $move.textContent = engine;
    $accel.checked = hasAccel;

    if (destX.toString() !== $destX.value) $destX.value = destX;
    if (destY.toString() !== $destY.value) $destY.value = destY;

    /* About the radar:
      - radar lvl 1 = 2 squares sight range = 3 squares movement
      - in diagonal, sight range *= 2 (dist x + dist y)
    */
    if (radar.toString() !== $radar.value) $radar.value = radar;
    var sightRange = radar + 1;
    $sight.textContent = sightRange;

    var distH = destX - x;
    var distV = destY - y;
    var absDistH = Math.abs(distH);
    var absDistV = Math.abs(distV);
    var distTot = absDistH + absDistV;
    var freeFuel = hasAccel ? 4 : 3;

    $distH.textContent = absDistH;
    $distV.textContent = absDistV;
    $distTot.textContent = distTot;

    $fuel.textContent = freeFuel;

    var eGames = Math.ceil(distTot / engine);
    var eDays = Math.ceil(eGames / freeFuel);
    $gamesE.textContent = eGames;
    $daysE.textContent = eDays;

    var angle = Math.atan(distV / distH);
    if (distH < 0) angle += π;

    /* To calculate how much movement the radar allows:
      considering the square “detected” zone, max movement is at the
      square’s vertices (45deg), min movement is at the center of the
      square’s edges (0deg, 90deg).
      In other terms. movement is max when distV = distH; movement is
      min when one of distX or distY is 0.
      So we calculate a ratio τ = smallDist / largeDist, and
      movement is simply sightRange * (1 + τ).
      Then add 1 because you can move 1 square outside of the “detected”
      zone.
      Don’t round the result, as the exact value is required to
      accurately calculate the radar bias on large distances.
    */
    var τ = absDistH < absDistV ?
      absDistH/absDistV : absDistV/absDistH;
    var allowedMovement = sightRange * (1 + τ) + 1;
    console.log("angle = %s°, allowed movement = %s",
      (angle * 180 / Math.PI).toFixed(3),
      allowedMovement.toFixed(3));

      var limiter = Math.min(engine, allowedMovement);
    var uGames = Math.ceil(distTot / limiter);
    var uDays = Math.ceil(uGames / freeFuel);
    $gamesU.textContent = uGames;
    $daysU.textContent = uDays;


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
  };
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

  // draws the arrow
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
