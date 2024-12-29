let currentImage = null;
const debugElement = document.getElementById("debug");

function log(message) {
  console.log(message);
  debugElement.innerHTML += message + "\n";
}

function clearLog() {
  debugElement.innerHTML = "";
}

function initializeViewer() {
  try {
    const element = document.getElementById("dicomImage");
    cornerstone.enable(element);
    log("Cornerstone initialized successfully");

    // Add mouse wheel event for zooming
    element.addEventListener("wheel", function (e) {
      if (!currentImage) return;

      const viewport = cornerstone.getViewport(element);
      if (e.deltaY < 0) {
        viewport.scale += 0.25;
      } else {
        viewport.scale -= 0.25;
      }
      cornerstone.setViewport(element, viewport);
      e.preventDefault();
    });
  } catch (error) {
    log("Error initializing Cornerstone: " + error.message);
  }
}

document
  .getElementById("dicom-file")
  .addEventListener("change", function (e) {
    clearLog();
    const file = e.target.files[0];
    log("File selected: " + file.name);

    const reader = new FileReader();

    reader.onload = function (file) {
      try {
        const arrayBuffer = file.target.result;
        log(
          "File loaded into buffer, size: " +
            arrayBuffer.byteLength +
            " bytes"
        );
        loadDicomFile(arrayBuffer);
      } catch (error) {
        log("Error reading file: " + error.message);
      }
    };

    reader.readAsArrayBuffer(file);
  });

function loadDicomFile(arrayBuffer) {
  try {
    const byteArray = new Uint8Array(arrayBuffer);
    log("Converting to byte array, length: " + byteArray.length);

    const dataSet = dicomParser.parseDicom(byteArray);
    log("DICOM parsed successfully");

    // Log important DICOM tags
    const sopClassUID = dataSet.string("x00080016");
    const modality = dataSet.string("x00080060");
    const bitsAllocated = dataSet.uint16("x00280100");
    const bitsStored = dataSet.uint16("x00280101");
    const highBit = dataSet.uint16("x00280102");
    const pixelRepresentation = dataSet.uint16("x00280103");
    const windowCenter = dataSet.floatString("x00281050") || 2048;
    const windowWidth = dataSet.floatString("x00281051") || 4096;
    const rescaleIntercept = dataSet.floatString("x00281052") || 0;
    const rescaleSlope = dataSet.floatString("x00281053") || 1;

    log(`SOP Class UID: ${sopClassUID}`);
    log(`Modality: ${modality}`);
    log(`Bits Allocated: ${bitsAllocated}`);
    log(`Bits Stored: ${bitsStored}`);
    log(`High Bit: ${highBit}`);
    log(`Pixel Representation: ${pixelRepresentation}`);
    log(`Window Center: ${windowCenter}`);
    log(`Window Width: ${windowWidth}`);
    log(`Rescale Intercept: ${rescaleIntercept}`);
    log(`Rescale Slope: ${rescaleSlope}`);

    const pixelDataElement = dataSet.elements.x7fe00010;
    if (!pixelDataElement) {
      throw new Error("No pixel data found in DICOM file");
    }

    log("Pixel data element found, length: " + pixelDataElement.length);

    const pixelData = new Uint16Array(
      dataSet.byteArray.buffer,
      pixelDataElement.dataOffset,
      pixelDataElement.length / 2
    );

    // Find actual min/max values
    let min = pixelData[0];
    let max = pixelData[0];
    for (let i = 1; i < pixelData.length; i++) {
      if (pixelData[i] < min) min = pixelData[i];
      if (pixelData[i] > max) max = pixelData[i];
    }
    log(`Actual pixel value range: ${min} to ${max}`);

    const rows = dataSet.uint16("x00280010");
    const columns = dataSet.uint16("x00280011");
    log(`Image dimensions: ${columns}x${rows}`);

    const image = {
      imageId: "dicomImage",
      minPixelValue: min,
      maxPixelValue: max,
      slope: rescaleSlope,
      intercept: rescaleIntercept,
      windowCenter: windowCenter,
      windowWidth: windowWidth,
      getPixelData: () => pixelData,
      rows: rows,
      columns: columns,
      height: rows,
      width: columns,
      color: false,
      columnPixelSpacing: dataSet.floatString("x00280030", 1),
      rowPixelSpacing: dataSet.floatString("x00280030", 1),
      sizeInBytes: pixelData.length * 2,
      render: cornerstone.renderGrayscaleImage,
    };

    currentImage = image;
    log("Image object created successfully");

    const element = document.getElementById("dicomImage");
    cornerstone.displayImage(element, image);
    log("Image displayed");

    // Set viewport to fit to window
    const viewport = cornerstone.getDefaultViewport(element, image);
    viewport.voi.windowWidth = windowWidth;
    viewport.voi.windowCenter = windowCenter;
    cornerstone.setViewport(element, viewport);
    fitImageToWindow();
    log("Viewport adjusted");

    // Update range inputs
    document.getElementById("windowWidth").value = windowWidth;
    document.getElementById("windowCenter").value = windowCenter;
  } catch (error) {
    log("Error processing DICOM file: " + error.message);
    console.error(error);
  }
}

function fitImageToWindow() {
  if (!currentImage) return;
  const element = document.getElementById("dicomImage");
  const viewport = cornerstone.getViewport(element);

  const imageAspectRatio = currentImage.width / currentImage.height;
  const elementAspectRatio = element.offsetWidth / element.offsetHeight;

  if (imageAspectRatio > elementAspectRatio) {
    viewport.scale = element.offsetWidth / currentImage.width;
  } else {
    viewport.scale = element.offsetHeight / currentImage.height;
  }

  viewport.translation.x = 0;
  viewport.translation.y = 0;
  cornerstone.setViewport(element, viewport);
}

// Event listeners for controls
document
  .getElementById("fitToWindow")
  .addEventListener("click", fitImageToWindow);

document
  .getElementById("actualSize")
  .addEventListener("click", function () {
    if (!currentImage) return;
    const element = document.getElementById("dicomImage");
    const viewport = cornerstone.getViewport(element);
    viewport.scale = 1;
    viewport.translation.x = 0;
    viewport.translation.y = 0;
    cornerstone.setViewport(element, viewport);
  });

document
  .getElementById("invertImage")
  .addEventListener("click", function () {
    if (!currentImage) return;
    const element = document.getElementById("dicomImage");
    const viewport = cornerstone.getViewport(element);
    viewport.invert = !viewport.invert;
    cornerstone.setViewport(element, viewport);
  });

document
  .getElementById("windowWidth")
  .addEventListener("input", function (e) {
    if (!currentImage) return;
    const element = document.getElementById("dicomImage");
    const viewport = cornerstone.getViewport(element);
    viewport.voi.windowWidth = Number(e.target.value);
    cornerstone.setViewport(element, viewport);
  });

document
  .getElementById("windowCenter")
  .addEventListener("input", function (e) {
    if (!currentImage) return;
    const element = document.getElementById("dicomImage");
    const viewport = cornerstone.getViewport(element);
    viewport.voi.windowCenter = Number(e.target.value);
    cornerstone.setViewport(element, viewport);
  });

// Begin version 07
// Event listeners for crop controls
document
  .getElementById("enableCrop")
  .addEventListener("click", function () {
    isCropping = !isCropping;
    this.classList.toggle("active-tool");

    if (!isCropping) {
      const overlay = document.getElementById("cropOverlay");
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      document
        .querySelector(".preview-container")
        .classList.remove("active");
    }
  });

document
  .getElementById("clearCrop")
  .addEventListener("click", function () {
    const overlay = document.getElementById("cropOverlay");
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    cropRegion = null;
    document
      .querySelector(".preview-container")
      .classList.remove("active");
  });

document
  .getElementById("maskColor")
  .addEventListener("change", function () {
    if (cropRegion) {
      showCropPreview();
    }
  });

//end version 07

window.onload = initializeViewer;

// Add these new variables for cropping
let isCropping = false;
let isDrawing = false;
let startX, startY, currentX, currentY;
let cropRegion = null;

function drawCropOverlay() {
  const overlay = document.getElementById("cropOverlay");
  const ctx = overlay.getContext("2d");

  ctx.clearRect(0, 0, overlay.width, overlay.height);

  // Draw semi-transparent overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, overlay.width, overlay.height);

  // Clear the selection rectangle
  ctx.clearRect(
    Math.min(startX, currentX),
    Math.min(startY, currentY),
    Math.abs(currentX - startX),
    Math.abs(currentY - startY)
  );

  // Draw selection rectangle border
  ctx.strokeStyle = "#00ff00";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    Math.min(startX, currentX),
    Math.min(startY, currentY),
    Math.abs(currentX - startX),
    Math.abs(currentY - startY)
  );
}

// V18      Key changes made:

// Added session tracking with cropSessionCounter

// Added detailed logging with prefixes:

// RESET: For variable resets
// START: For beginning of crop operations
// UPDATE: For significant changes during drawing
// END: For completion of crop operations
// PREVIEW: For preview generation steps
// Enhanced reset functionality:

// More comprehensive variable clearing
// Added logging for all reset operations
// Clear feedback on tool state changes
// Added session separation in logs with divider lines

// To implement:

// Add the cropSessionCounter variable at the top of your script with other global variables
// Replace the existing resetCropVariables, initializeCropping, and showCropPreview functions with these new versions
// Now you'll be able to:

// Track each drawing session separately
// See when variables are reset
// Identify which stage of the process might be causing issues
// Monitor the scaling calculations
// The debug panel will show detailed information about:

// When variables are reset
// Start and end of each crop session
// Coordinate translations
// Preview generation steps
// This should help identify exactly where any erratic behavior is occurring. Let me know if you'd like any adjustments to the logging detail or if you see any specific patterns in the debug output that need attention.
let cropSessionCounter = 0;

function resetCropVariables() {
  isDrawing = false;
  startX = null;
  startY = null;
  currentX = null;
  currentY = null;
  log("RESET: Crop variables have been reset");
  log(
    `RESET: isDrawing=${isDrawing}, startX=${startX}, startY=${startY}, currentX=${currentX}, currentY=${currentY}`
  );
}

function initializeCropping() {
  const overlay = document.getElementById("cropOverlay");
  const element = document.getElementById("dicomImage");

  function updateOverlaySize() {
    overlay.width = element.offsetWidth;
    overlay.height = element.offsetHeight;
    if (cropRegion) {
      drawCropOverlay();
    }
  }

  updateOverlaySize();
  window.addEventListener("resize", updateOverlaySize);

  document
    .getElementById("enableCrop")
    .addEventListener("click", function () {
      resetCropVariables();
      if (!this.classList.contains("active-tool")) {
        cropRegion = null;
        log("RESET: Crop tool disabled - all variables cleared");
      } else {
        log("RESET: Crop tool enabled - ready for new selection");
      }
      cropSessionCounter = 0;
    });

  // Add clear handler with logging
  document
    .getElementById("clearCrop")
    .addEventListener("click", function () {
      resetCropVariables();
      cropRegion = null;
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      document
        .querySelector(".preview-container")
        .classList.remove("active");
      cropSessionCounter = 0;
      log(
        "RESET: Manual clear requested - all variables and display cleared"
      );
    });

  element.addEventListener("mousedown", startCropDraw);
  element.addEventListener("mousemove", updateCropDraw);
  element.addEventListener("mouseup", endCropDraw);
  element.addEventListener("mouseleave", function () {
    if (isDrawing) {
      log("RESET: Mouse left drawing area - canceling current operation");
      resetCropVariables();
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  });

  function startCropDraw(e) {
    if (!isCropping) return;

    // Reset previous crop
    cropRegion = null;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    document
      .querySelector(".preview-container")
      .classList.remove("active");

    cropSessionCounter++;
    log(`START: New crop session #${cropSessionCounter}`);

    isDrawing = true;
    const rect = element.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    currentX = startX;
    currentY = startY;

    log(
      `START: Initial coordinates - startX=${startX}, startY=${startY}`
    );
  }

  function updateCropDraw(e) {
    if (!isDrawing) return;

    const rect = element.getBoundingClientRect();
    currentX = e.clientX - rect.left;
    currentY = e.clientY - rect.top;

    // Log significant coordinate changes (optional - might be too verbose)
    // if (Math.abs(currentX - startX) > 50 || Math.abs(currentY - startY) > 50) {
    //     log(`UPDATE: Significant movement in session #${cropSessionCounter} - currentX=${currentX}, currentY=${currentY}`);
    // }

    drawCropOverlay();
  }

  function endCropDraw() {
    if (!isDrawing) return;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    log(`END: Completing crop session #${cropSessionCounter}`);
    log(`END: Final dimensions - width=${width}, height=${height}`);

    isDrawing = false;

    // Only create crop region if there's a meaningful selection
    const minSize = 10; // Minimum 10 pixels in each dimension

    if (width > minSize && height > minSize) {
      cropRegion = {
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: width,
        height: height,
      };
      log(
        `END: Valid selection created in session #${cropSessionCounter}`
      );
      showCropPreview();
    } else {
      // Clear if selection is too small
      log(
        `END: Selection too small in session #${cropSessionCounter} - clearing`
      );
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      cropRegion = null;
      document
        .querySelector(".preview-container")
        .classList.remove("active");
    }

    // Reset variables after successful end
    resetCropVariables();
  }
}

// V21
//       I see that while we're getting good coordinate calculations, the preview is still empty despite the "Preview rendered successfully" message. Let's try a simpler approach that directly copies the image data from the main canvas:
//       Key changes:

// Instead of trying to re-render with Cornerstone, we're directly copying from the already-rendered canvas
// Simplified the coordinate translation since we're working with screen coordinates
// Removed the temporary canvas and complex scaling calculations
// Using the browser's built-in canvas scaling through drawImage
// This should work better because:

// We're using the exact pixels that are already visible on screen
// The window/level adjustments are already applied
// We're working with screen coordinates directly instead of trying to convert to image coordinates
// Please try this version and let me know if you now see the preview properly. If it's still not working, could you check if there are any JavaScript console errors?

function showCropPreview() {
  if (!cropRegion || !currentImage) {
    log("PREVIEW: No valid crop region to preview");
    return;
  }

  log(
    `PREVIEW: Starting preview for crop session #${cropSessionCounter}`
  );
  log(
    `PREVIEW: Using crop region - x=${cropRegion.x}, y=${cropRegion.y}, w=${cropRegion.width}, h=${cropRegion.height}`
  );

  const previewContainer = document.querySelector(".preview-container");
  previewContainer.classList.add("active");

  const previewCanvas = document.getElementById("previewCanvas");
  const element = document.getElementById("dicomImage");
  const viewport = cornerstone.getViewport(element);

  // Get the canvas from the enabled element (this is where Cornerstone renders)
  const sourceCanvas = element.querySelector("canvas");

  // Set preview canvas size (maintaining aspect ratio)
  const maxPreviewWidth = 400;
  const scale = Math.min(1, maxPreviewWidth / cropRegion.width);
  previewCanvas.width = Math.round(cropRegion.width * scale);
  previewCanvas.height = Math.round(cropRegion.height * scale);

  log(
    `Crop region (screen): x=${cropRegion.x}, y=${cropRegion.y}, w=${cropRegion.width}, h=${cropRegion.height}`
  );

  const ctx = previewCanvas.getContext("2d");
  ctx.drawImage(
    sourceCanvas,
    cropRegion.x,
    cropRegion.y,
    cropRegion.width,
    cropRegion.height, // Source coordinates
    0,
    0,
    previewCanvas.width,
    previewCanvas.height // Destination coordinates
  );

  log(`Preview size: ${previewCanvas.width}x${previewCanvas.height}`);
  log(
    `Window level: center=${viewport.voi.windowCenter}, width=${viewport.voi.windowWidth}`
  );
  log(
    `Resulting image dimensions: ${previewCanvas.width}x${previewCanvas.height}`
  );
}

// Update window/level change handlers to refresh preview
document
  .getElementById("windowWidth")
  .addEventListener("input", function (e) {
    if (!currentImage) return;
    const element = document.getElementById("dicomImage");
    const viewport = cornerstone.getViewport(element);
    viewport.voi.windowWidth = Number(e.target.value);
    cornerstone.setViewport(element, viewport);
    if (cropRegion) {
      showCropPreview();
    }
  });

document
  .getElementById("windowCenter")
  .addEventListener("input", function (e) {
    if (!currentImage) return;
    const element = document.getElementById("dicomImage");
    const viewport = cornerstone.getViewport(element);
    viewport.voi.windowCenter = Number(e.target.value);
    cornerstone.setViewport(element, viewport);
    if (cropRegion) {
      showCropPreview();
    }
  });

// Modify the window.onload to initialize cropping
window.onload = function () {
  initializeViewer();
  initializeCropping();
};