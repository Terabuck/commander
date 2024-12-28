document.getElementById('dicom-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        const byteArray = new Uint8Array(arrayBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);
        const pixelDataElement = dataSet.elements.x7fe00010;
        const pixelData = new Uint16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2);

        const dicomImageDiv = document.getElementById('dicom-image');
        cornerstone.enable(dicomImageDiv);
        const image = {
            imageId: 'dicomImage',
            minPixelValue: 0,
            maxPixelValue: 255,
            slope: 1.0,
            intercept: 0,
            windowCenter: 128,
            windowWidth: 256,
            render: cornerstone.renderGrayscaleImage,
            getPixelData: () => pixelData,
            rows: dataSet.uint16('x00280010'),
            columns: dataSet.uint16('x00280011'),
            height: dataSet.uint16('x00280010'),
            width: dataSet.uint16('x00280011'),
            color: false,
            columnPixelSpacing: 1.0,
            rowPixelSpacing: 1.0,
            invert: false,
            sizeInBytes: pixelData.length * 2
        };
        cornerstone.displayImage(dicomImageDiv, image);

        // Arrange the DICOM images based on their tags
        const formattedTags = getFormattedTags(dataSet);
        const containerId = getContainerId(formattedTags);
        const container = document.getElementById(containerId);
        const thumbnail = document.createElement('img');
        thumbnail.src = dicomImageDiv.toDataURL();
        thumbnail.alt = 'DICOM Thumbnail';
        thumbnail.className = 'thumbnail';
        thumbnail.onclick = () => showImage(thumbnail.src);
        container.appendChild(thumbnail);
    };
    reader.readAsArrayBuffer(file);
});

let cropMode = 'rectangle';
let maskColor = 'black';

document.querySelectorAll('input[name="crop-mode"]').forEach((input) => {
    input.addEventListener('change', function(event) {
        cropMode = event.target.value;
    });
});

document.querySelectorAll('input[name="mask-color"]').forEach((input) => {
    input.addEventListener('change', function(event) {
        maskColor = event.target.value;
    });
});

document.getElementById('crop-button').addEventListener('click', function() {
    // Implement cropping functionality here
    // Use cropMode and maskColor to determine the cropping behavior
});

function getFormattedTags(dataSet) {
    const laterality = dataSet.string('x00200062') || 'Unknown';
    const viewPosition = dataSet.string('x00185101') || 'Unknown';
    return `${laterality}-${viewPosition}`;
}

function getContainerId(formattedTags) {
    switch (formattedTags) {
        case 'R-CC':
            return 'R-CC-container';
        case 'L-CC':
            return 'L-CC-container';
        case 'R-MLO':
            return 'R-MLO-container';
        case 'L-MLO':
            return 'L-MLO-container';
        default:
            return 'non-mammo-container';
    }
}

function showImage(src) {
    const selectedImage = document.getElementById('selected-image');
    selectedImage.src = src;
    const cropCanvas = document.getElementById('crop-canvas');
    cropCanvas.width = selectedImage.naturalWidth;
    cropCanvas.height = selectedImage.naturalHeight;
    cropCanvas.style.width = selectedImage.width + 'px';
    cropCanvas.style.height = selectedImage.height + 'px';
}
