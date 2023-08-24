var BTN_TEXT_CANCEL = "Закрыть";
var BTN_TEXT_CLEAR = "Очистить";
var BTN_TEXT_OK = "Отправить";
var MAXRETRIES = 20;
var TIMEOUT_LONG = 1000;
var TIMEOUT_SHORT = 500;

var canvas;
var ctx;
var formDiv;
var intf;
var isDown;
var lastPoint;
var m_btns; // The array of buttons that we are emulating.
var m_clickBtn = -1;
var m_capability;
var m_encodingMode;
var m_imgData;
var m_inkThreshold;
var m_penData;
var m_usbDevices;
var modalBackground;
var protocol;
var retry = 0;
var tablet;

var mainUrl = "";
var documentUnid = "";
var useType = "";

function checkForSigCaptX() {
  // Establishing a connection to SigCaptX Web Service can take a few seconds,
  // particularly if the browser itself is still loading/initialising
  // or on a slower machine.
  retry = retry + 1;
  if (WacomGSS.STU.isServiceReady()) {
    retry = 0;
    console.log("SigCaptX Web Service: ready");
  } else {
    console.log("SigCaptX Web Service: not connected");
    if (retry < MAXRETRIES) {
      setTimeout(checkForSigCaptX, TIMEOUT_LONG);
    } else {
      alert("Unable to establish connection to SigCaptX");
    }
  }
}

setTimeout(checkForSigCaptX, TIMEOUT_SHORT);

function onDCAtimeout() {
  // Device Control App has timed-out and shut down
  // For this sample, we just closedown tabletDemoEx (assuming it s running)
  console.log("DCA disconnected");
  setTimeout(close, 0);
}

function Rectangle(x, y, width, height) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;

  this.Contains = function (pt) {
    if (
      pt.x >= this.x &&
      pt.x <= this.x + this.width &&
      pt.y >= this.y &&
      pt.y <= this.y + this.height
    ) {
      return true;
    } else {
      return false;
    }
  };
}

// In order to simulate buttons, we have our own Button class that stores the bounds and event handler.
// Using an array of these makes it easy to add or remove buttons as desired.
//  delegate void ButtonClick();
function Button() {
  this.Bounds; // in Screen coordinates
  this.Text;
  this.Click;
}

function Point(x, y) {
  this.x = x;
  this.y = y;
}

function createModalWindow(width, height) {
  const bodyTag = document.getElementsByTagName("body")[0];

  //  Creates the modal window on the PC monitor
  modalBackground = document.createElement("div");
  modalBackground.id = "modal-background";
  modalBackground.className = "active";
  modalBackground.style.top = 0;
  modalBackground.style.position = "absolute";
  modalBackground.style.background = "rgba(0, 0, 0, 0.6)";
  modalBackground.style.width = "100%";
  modalBackground.style.height = "100%";
  bodyTag.appendChild(modalBackground);

  formDiv = document.createElement("div");
  formDiv.id = "signatureWindow";
  formDiv.className = "active";
  formDiv.style.top = window.innerHeight / 2 - height / 2 + "px";
  formDiv.style.left = window.innerWidth / 2 - width / 2 + "px";
  formDiv.style.width = width + "px";
  formDiv.style.height = height + "px";
  formDiv.style.position = "absolute";
  formDiv.style.background = "#fff";
  bodyTag.appendChild(formDiv);

  canvas = document.createElement("canvas");
  canvas.id = "myCanvas";
  canvas.height = formDiv.offsetHeight;
  canvas.width = formDiv.offsetWidth;
  formDiv.appendChild(canvas);
  ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (canvas.addEventListener) {
    canvas.addEventListener("click", onCanvasClick, false);
  } else if (canvas.attachEvent) {
    canvas.attachEvent("onClick", onCanvasClick);
  } else {
    canvas["onClick"] = onCanvasClick;
  }
}

function disconnect() {
  var deferred = Q.defer();

  if (!(undefined === tablet || null === tablet)) {
    var p = new WacomGSS.STU.Protocol();
    tablet
      .setInkingMode(p.InkingMode.InkingMode_Off)
      .then(function (message) {
        console.log("received: " + JSON.stringify(message));
        return tablet.endCapture();
      })
      .then(function (message) {
        console.log("received: " + JSON.stringify(message));
        if (m_imgData !== null) {
          return m_imgData.remove();
        } else {
          return message;
        }
      })
      .then(function (message) {
        console.log("received: " + JSON.stringify(message));
        m_imgData = null;
        return tablet.setClearScreen();
      })
      .then(function (message) {
        console.log("received: " + JSON.stringify(message));
        return tablet.disconnect();
      })
      .then(function (message) {
        console.log("received: " + JSON.stringify(message));
        tablet = null;
        clearCanvas(canvas, ctx);
      })
      .then(function (message) {
        deferred.resolve();
      })
      .fail(function (message) {
        console.log("disconnect error: " + message);
        deferred.resolve();
      });
  } else {
    deferred.resolve();
  }
  return deferred.promise;
}

const blockReloadFunc = function (e) {
  var confirmationMessage = "";
  WacomGSS.STU.close();
  (e || window.event).returnValue = confirmationMessage; // Gecko + IE
  return confirmationMessage; // Webkit, Safari, Chrome
};

window.addEventListener("beforeunload", blockReloadFunc);

// Error-derived object for Device Control App not ready exception
function DCANotReady() {}
DCANotReady.prototype = new Error();

function tabletDemo(main_Url, type, unid, test) {
  if (test) {
    fetch(
      `${mainUrl}/?.handler=Rest&f=sign&type=${useType}&unid=${documentUnid}`,
      {
        body: JSON.stringify({
          file: "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",
        }),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "cors",
      }
    );
  };
  useType = type;
  documentUnid = unid;
  mainUrl = main_Url;
  tabletDemoEx();
}

function tabletDemoEx() {
  var p = new WacomGSS.STU.Protocol();
  var intf;
  var m_encH;
  var m_encH2;
  var m_encH2Impl;

  WacomGSS.STU.isDCAReady()
    .then(function (message) {
      if (!message) {
        throw new DCANotReady();
      }
      // Set handler for Device Control App timeout
      WacomGSS.STU.onDCAtimeout = onDCAtimeout;

      return WacomGSS.STU.getUsbDevices();
    })
    .then(function (message) {
      if (message == null || message.length == 0) {
        throw new Error("No STU devices found");
      }
      console.log("received: " + JSON.stringify(message));
      m_usbDevices = message;
      return WacomGSS.STU.isSupportedUsbDevice(
        m_usbDevices[0].idVendor,
        m_usbDevices[0].idProduct
      );
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      intf = new WacomGSS.STU.UsbInterface();
      return intf.Constructor();
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      return intf.connect(m_usbDevices[0], true);
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      tablet = new WacomGSS.STU.Tablet();
      return tablet.Constructor(intf, m_encH, m_encH2);
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      intf = null;
      return tablet.getInkThreshold();
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      m_inkThreshold = message;
      return tablet.getCapability();
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      m_capability = message;
      createModalWindow(m_capability.screenWidth, m_capability.screenHeight);
      return tablet.getInformation();
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      return tablet.getInkThreshold();
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      return tablet.getProductId();
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      return WacomGSS.STU.ProtocolHelper.simulateEncodingFlag(
        message,
        m_capability.encodingFlag
      );
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      var encodingFlag = message;
      if ((encodingFlag & p.EncodingFlag.EncodingFlag_24bit) != 0) {
        return tablet.supportsWrite().then(function (message) {
          m_encodingMode = message
            ? p.EncodingMode.EncodingMode_24bit_Bulk
            : p.EncodingMode.EncodingMode_24bit;
        });
      } else if ((encodingFlag & p.EncodingFlag.EncodingFlag_16bit) != 0) {
        return tablet.supportsWrite().then(function (message) {
          m_encodingMode = message
            ? p.EncodingMode.EncodingMode_16bit_Bulk
            : p.EncodingMode.EncodingMode_16bit;
        });
      } else {
        // assumes 1bit is available
        m_encodingMode = p.EncodingMode.EncodingMode_1bit;
      }
    })
    .then(function (message) {
      return tablet.setClearScreen();
    })
    .then(function (message) {
      console.log("received from setClearScreen: " + JSON.stringify(message));
      return message;
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      return tablet.isSupported(p.ReportId.ReportId_PenDataOptionMode);
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      if (message) {
        return tablet.getProductId().then(function (message) {
          var penDataOptionMode = p.PenDataOptionMode.PenDataOptionMode_None;
          switch (message) {
            case WacomGSS.STU.ProductId.ProductId_520A:
              penDataOptionMode =
                p.PenDataOptionMode.PenDataOptionMode_TimeCount;
              break;
            case WacomGSS.STU.ProductId.ProductId_430:
            case WacomGSS.STU.ProductId.ProductId_530:
            case WacomGSS.STU.ProductId.ProductId_540:
              penDataOptionMode =
                p.PenDataOptionMode.PenDataOptionMode_TimeCountSequence;
              break;
            default:
              console.log(
                "Unknown tablet supporting PenDataOptionMode, setting to None."
              );
          }
          return tablet.setPenDataOptionMode(penDataOptionMode);
        });
      } else {
        m_encodingMode = p.EncodingMode.EncodingMode_1bit;
        return m_encodingMode;
      }
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      addButtons();
      var canvasImage = canvas.toDataURL("image/jpeg");
      return WacomGSS.STU.ProtocolHelper.resizeAndFlatten(
        canvasImage,
        0,
        0,
        0,
        0,
        m_capability.screenWidth,
        m_capability.screenHeight,
        m_encodingMode,
        1,
        false,
        0,
        true
      );
    })
    .then(function (message) {
      m_imgData = message;
      console.log("received: " + JSON.stringify(message));
      return tablet.writeImage(m_encodingMode, message);
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      return tablet.setInkingMode(p.InkingMode.InkingMode_On);
    })
    .then(function (message) {
      console.log("received: " + JSON.stringify(message));
      var reportHandler = new WacomGSS.STU.ProtocolHelper.ReportHandler();
      lastPoint = { x: 0, y: 0 };
      isDown = false;
      ctx.lineWidth = 1;

      var penData = function (report) {
        //console.log("report: " + JSON.stringify(report));
        processButtons(report, canvas);
        processPoint(report, canvas, ctx);
        m_penData.push(report);
      };
      var penDataEncryptedOption = function (report) {
        //console.log("reportOp: " + JSON.stringify(report));
        processButtons(report.penData[0], canvas);
        processPoint(report.penData[0], canvas, ctx);
        processButtons(report.penData[1], canvas);
        processPoint(report.penData[1], canvas, ctx);
        m_penData.push(report.penData[0], report.penData[1]);
      };

      var log = function (report) {
        //console.log("report: " + JSON.stringify(report));
      };

      var decrypted = function (report) {
        //console.log("decrypted: " + JSON.stringify(report));
      };
      m_penData = new Array();
      reportHandler.onReportPenData = penData;
      reportHandler.onReportPenDataOption = penData;
      reportHandler.onReportPenDataTimeCountSequence = penData;
      reportHandler.onReportPenDataEncrypted = penDataEncryptedOption;
      reportHandler.onReportPenDataEncryptedOption = penDataEncryptedOption;
      reportHandler.onReportPenDataTimeCountSequenceEncrypted = penData;
      reportHandler.onReportDevicePublicKey = log;
      reportHandler.onReportEncryptionStatus = log;
      reportHandler.decrypt = decrypted;
      return reportHandler.startReporting(tablet, true);
    })
    .fail(function (ex) {
      console.log(ex);

      if (ex instanceof DCANotReady) {
        // Device Control App not detected
        // Reinitialize and re-try
        WacomGSS.STU.Reinitialize();
        setTimeout(tabletDemoEx, TIMEOUT_LONG);
      } else {
        // Some other error - Inform the user and closedown
        alert("tabletDemoEx failed: " + ex);
        setTimeout(close(), 0);
      }
    });
}

function addButtons() {
  m_btns = new Array(3);
  m_btns[0] = new Button();
  m_btns[1] = new Button();
  m_btns[2] = new Button();

  if (m_usbDevices[0].idProduct != WacomGSS.STU.ProductId.ProductId_300) {
    // Place the buttons across the bottom of the screen.
    var w2 = m_capability.screenWidth / 3;
    var w3 = m_capability.screenWidth / 3;
    var w1 = m_capability.screenWidth - w2 - w3;
    var y = (m_capability.screenHeight * 6) / 7;
    var h = m_capability.screenHeight - y;

    m_btns[0].Bounds = new Rectangle(0, y, w1, h);
    m_btns[1].Bounds = new Rectangle(w1, y, w2, h);
    m_btns[2].Bounds = new Rectangle(w1 + w2, y, w3, h);
  } else {
    // The STU-300 is very shallow, so it is better to utilise
    // the buttons to the side of the display instead.

    var x = (m_capability.screenWidth * 3) / 4;
    var w = m_capability.screenWidth - x;

    var h2 = m_capability.screenHeight / 3;
    var h3 = m_capability.screenHeight / 3;
    var h1 = m_capability.screenHeight - h2 - h3;

    m_btns[0].Bounds = new Rectangle(x, 0, w, h1);
    m_btns[1].Bounds = new Rectangle(x, h1, w, h2);
    m_btns[2].Bounds = new Rectangle(x, h1 + h2, w, h3);
  }

  m_btns[0].Text = BTN_TEXT_OK;
  m_btns[1].Text = BTN_TEXT_CLEAR;
  m_btns[2].Text = BTN_TEXT_CANCEL;
  m_btns[0].Click = btnOk_Click;
  m_btns[1].Click = btnClear_Click;
  m_btns[2].Click = btnCancel_Click;
  // clearCanvas(canvas, ctx);
  drawButtons();
}

function drawButtons() {
  // This application uses the same bitmap for both the screen and client (window).

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "black";
  ctx.font = "16px Arial";

  // Draw the buttons
  for (var i = 0; i < m_btns.length; ++i) {
    //if (useColor)
    {
      ctx.fillStyle = "lightgrey";
      ctx.fillRect(
        m_btns[i].Bounds.x,
        m_btns[i].Bounds.y,
        m_btns[i].Bounds.width,
        m_btns[i].Bounds.height
      );
    }

    ctx.fillStyle = "black";
    ctx.rect(
      m_btns[i].Bounds.x,
      m_btns[i].Bounds.y,
      m_btns[i].Bounds.width,
      m_btns[i].Bounds.height
    );
    var xPos =
      m_btns[i].Bounds.x +
      (m_btns[i].Bounds.width / 2 - ctx.measureText(m_btns[i].Text).width / 2);
    var yOffset;
    if (m_usbDevices[0].idProduct == WacomGSS.STU.ProductId.ProductId_300)
      yOffset = 24;
    else if (m_usbDevices[0].idProduct == WacomGSS.STU.ProductId.ProductId_430)
      yOffset = 22;
    else yOffset = 36;
    ctx.fillText(m_btns[i].Text, xPos, m_btns[i].Bounds.y + yOffset);
  }
  ctx.stroke();
  ctx.closePath();

  ctx.restore();
}

function clearScreen() {
  clearCanvas(canvas, ctx);
  drawButtons();
  m_penData = new Array();
  tablet.writeImage(m_encodingMode, m_imgData);
}

function btnOk_Click() {
  // You probably want to add additional processing here.
  // generateImage();
  saveImage();
  setTimeout(close, 0);
}

function btnCancel_Click() {
  // You probably want to add additional processing here.
  setTimeout(close, 0);
}

function btnClear_Click() {
  // You probably want to add additional processing here.
  console.log("clear!");
  clearScreen();
}

function distance(a, b) {
  return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
}

function clearCanvas(in_canvas, in_ctx) {
  in_ctx.save();
  in_ctx.setTransform(1, 0, 0, 1, 0, 0);
  in_ctx.fillStyle = "white";
  in_ctx.fillRect(0, 0, in_canvas.width, in_canvas.height);
  in_ctx.restore();
}

function processButtons(point, in_canvas) {
  var nextPoint = {};
  nextPoint.x = Math.round(
    (in_canvas.width * point.x) / m_capability.tabletMaxX
  );
  nextPoint.y = Math.round(
    (in_canvas.height * point.y) / m_capability.tabletMaxY
  );
  var isDown2 = isDown
    ? !(point.pressure <= m_inkThreshold.offPressureMark)
    : point.pressure > m_inkThreshold.onPressureMark;

  var btn = -1;
  for (var i = 0; i < m_btns.length; ++i) {
    if (m_btns[i].Bounds.Contains(nextPoint)) {
      btn = i;
      break;
    }
  }

  if (isDown && !isDown2) {
    if (btn != -1 && m_clickBtn === btn) {
      m_btns[btn].Click();
    }
    m_clickBtn = -1;
  } else if (btn != -1 && !isDown && isDown2) {
    m_clickBtn = btn;
  }
  return btn == -1;
}

function processPoint(point, in_canvas, in_ctx) {
  var nextPoint = {};
  nextPoint.x = Math.round(
    (in_canvas.width * point.x) / m_capability.tabletMaxX
  );
  nextPoint.y = Math.round(
    (in_canvas.height * point.y) / m_capability.tabletMaxY
  );
  var isDown2 = isDown
    ? !(point.pressure <= m_inkThreshold.offPressureMark)
    : point.pressure > m_inkThreshold.onPressureMark;

  if (!isDown && isDown2) {
    lastPoint = nextPoint;
  }

  if (
    (isDown2 && 10 < distance(lastPoint, nextPoint)) ||
    (isDown && !isDown2)
  ) {
    in_ctx.beginPath();
    in_ctx.moveTo(lastPoint.x, lastPoint.y);
    in_ctx.lineTo(nextPoint.x, nextPoint.y);
    in_ctx.stroke();
    in_ctx.closePath();
    lastPoint = nextPoint;
  }

  isDown = isDown2;
}

async function saveImage() {
  var signatureCanvas = document.createElement("canvas");
  signatureCanvas.id = "signatureCanvas";
  signatureCanvas.height = 200;
  signatureCanvas.width = 300;
  var signatureCtx = signatureCanvas.getContext("2d");

  clearCanvas(signatureCanvas, signatureCtx);
  signatureCtx.lineWidth = 1;
  signatureCtx.strokeStyle = "black";
  lastPoint = { x: 0, y: 0 };
  isDown = false;

  for (var i = 0; i < m_penData.length; i++) {
    processPoint(m_penData[i], signatureCanvas, signatureCtx);
  }
  // signatureCanvas.toDataURL()
  await fetch(
    `${mainUrl}/?.handler=Rest&f=sign&type=${useType}&unid=${documentUnid}`,
    {
      body: JSON.stringify({
        file: signatureCanvas.toDataURL().split(";base64,")[1],
      }),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: "cors",
    }
  );
  window.removeEventListener("beforeunload", blockReloadFunc);
  location.reload();
}

function generateImage() {
  signatureImage = new Image(300, 200);
  var signatureCanvas = document.createElement("canvas");
  signatureCanvas.id = "signatureCanvas";
  signatureCanvas.height = signatureImage.height;
  signatureCanvas.width = signatureImage.width;
  var signatureCtx = signatureCanvas.getContext("2d");

  clearCanvas(signatureCanvas, signatureCtx);
  signatureCtx.lineWidth = 1;
  signatureCtx.strokeStyle = "black";
  lastPoint = { x: 0, y: 0 };
  isDown = false;

  for (var i = 0; i < m_penData.length; i++) {
    processPoint(m_penData[i], signatureCanvas, signatureCtx);
  }
  signatureImage.src = signatureCanvas.toDataURL("image/jpeg");
}

function close() {
  // Clear handler for Device Control App timeout
  WacomGSS.STU.onDCAtimeout = null;

  disconnect();
  document.getElementsByTagName("body")[0].removeChild(modalBackground);
  document.getElementsByTagName("body")[0].removeChild(formDiv);
}

function onCanvasClick(event) {
  // Enable the mouse to click on the simulated buttons that we have displayed.

  // Note that this can add some tricky logic into processing pen data
  // if the pen was down at the time of this click, especially if the pen was logically
  // also "pressing" a button! This demo however ignores any that.

  var posX = event.pageX - formDiv.offsetLeft;
  var posY = event.pageY - formDiv.offsetTop;

  for (var i = 0; i < m_btns.length; i++) {
    if (m_btns[i].Bounds.Contains(new Point(posX, posY))) {
      m_btns[i].Click();
      break;
    }
  }
}
