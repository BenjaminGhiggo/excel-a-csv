// Variables de estado
let originalData = [];
let modifiedData = [];
let deletedColumns = [];
let prefixedColumns = {};
let isHeader = false;
let fileName = "";

// Elementos del DOM
const fileInput = document.getElementById('file-input');
const fileMessage = document.getElementById('file-message');
const previewSection = document.getElementById('preview-section');
const tableContainer = document.getElementById('table-container');
const optionsAccordion = document.getElementById('optionsAccordion');
const columnSelect = document.getElementById('column-select');
const deleteColumnBtn = document.getElementById('delete-column-btn');
const undoDeleteColumnBtn = document.getElementById('undo-delete-column-btn');
const deleteMessage = document.getElementById('delete-message');
const prefixColumnSelect = document.getElementById('prefix-column-select');
const prefixInput = document.getElementById('prefix-input');
const addPrefixBtn = document.getElementById('add-prefix-btn');
const removePrefixBtn = document.getElementById('remove-prefix-btn');
const undoPrefixBtn = document.getElementById('undo-prefix-btn');
const prefixMessage = document.getElementById('prefix-message');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');
const loaderOverlay = document.getElementById('loader-overlay');

// --- NUEVA FUNCIÓN: para obtener el nombre base del archivo sin extensión
function getFileNameWithoutExtension(filename) {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return filename;
    return filename.substring(0, lastDotIndex);
}

// Función para detectar si la primera fila es encabezado
function detectHeader(data) {
    const firstRow = data[0];
    return firstRow.every(cell => typeof cell === 'string');
}

// Función para renderizar la tabla
function renderTable(data) {
    let table = '<table class="table table-bordered table-hover"><thead><tr>';
    data[0].forEach(header => {
        table += `<th>${header}</th>`;
    });
    table += '</tr></thead><tbody>';
    // Mostrar solo las primeras 5 filas y permitir scroll para el resto
    const rowsToShow = data.slice(0, 6); // 1 fila de encabezado + 5 filas de datos
    for (let i = 1; i < rowsToShow.length; i++) {
        table += '<tr>';
        rowsToShow[i].forEach(cell => {
            table += `<td>${cell}</td>`;
        });
        table += '</tr>';
    }
    table += '</tbody></table>';
    tableContainer.innerHTML = table;
}

// Función para actualizar los select de columnas
function updateColumnSelects() {
    // Limpiar opciones
    columnSelect.innerHTML = '';
    prefixColumnSelect.innerHTML = '';

    // Agregar nuevas opciones
    modifiedData[0].forEach((col, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.text = col;
        columnSelect.appendChild(option);

        const optionPrefix = document.createElement('option');
        optionPrefix.value = index;
        optionPrefix.text = col;
        prefixColumnSelect.appendChild(optionPrefix);
    });
}

// Función para mostrar mensajes con Bootstrap
function showMessage(element, message, type) {
    element.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
}

// Función para mostrar el loader
function showLoader() {
    loaderOverlay.style.display = 'flex';
}

// Función para ocultar el loader
function hideLoader() {
    loaderOverlay.style.display = 'none';
}

// Evento al subir archivo
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName = file.name;
        showLoader(); // Mostrar loader durante el procesamiento

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            if (jsonData.length === 0) {
                showMessage(fileMessage, '❌ El archivo está vacío.', 'danger');
                hideLoader();
                return;
            }
            isHeader = detectHeader(jsonData);
            if (isHeader) {
                showMessage(fileMessage, '✅ Se detectó que la primera fila es un encabezado y se utilizó como tal.', 'success');
            } else {
                showMessage(fileMessage, 'ℹ️ La primera fila no parece ser un encabezado. Se asignaron nombres genéricos a las columnas para ayudarte.', 'warning');
                // Asignar nombres genéricos
                const numCols = jsonData[0].length;
                const genericHeaders = [];
                for (let i = 0; i < numCols; i++) {
                    genericHeaders.push(`Columna ${i + 1}`);
                }
                jsonData[0] = genericHeaders;
            }

            // Crear encabezados al estilo Excel sin eliminar nombres originales
            const originalHeaders = jsonData[0];
            const excelHeaders = originalHeaders.map((name, i) => `${String.fromCharCode(65 + i)} (${name})`);
            jsonData[0] = excelHeaders;

            originalData = JSON.parse(JSON.stringify(jsonData)); // Copiar datos originales
            modifiedData = JSON.parse(JSON.stringify(jsonData));
            deletedColumns = [];
            prefixedColumns = {};

            // Mostrar secciones
            previewSection.style.display = 'block';
            optionsAccordion.style.display = 'block';
            downloadSection.style.display = 'block';

            renderTable(modifiedData);
            updateColumnSelects();

            hideLoader(); // Ocultar loader después del procesamiento
        };
        reader.readAsArrayBuffer(file);
    }
});

// Evento para eliminar columna
deleteColumnBtn.addEventListener('click', () => {
    const colIndex = parseInt(columnSelect.value);
    if (isNaN(colIndex)) {
        showMessage(deleteMessage, '❌ Selecciona una columna válida.', 'danger');
        return;
    }
    const colName = modifiedData[0][colIndex];
    // Guardar columna eliminada
    const deletedCol = modifiedData.map(row => row[colIndex]);
    deletedColumns.push({ name: colName, data: deletedCol, index: colIndex });
    // Eliminar columna
    modifiedData = modifiedData.map(row => row.filter((_, idx) => idx !== colIndex));
    showMessage(deleteMessage, `✅ Columna '${colName}' eliminada.`, 'success');
    renderTable(modifiedData);
    updateColumnSelects();
});

// Evento para revertir eliminación de columna
undoDeleteColumnBtn.addEventListener('click', () => {
    if (deletedColumns.length === 0) {
        showMessage(deleteMessage, '⚠️ No hay columnas para restaurar.', 'warning');
        return;
    }
    const lastDeleted = deletedColumns.pop();
    // Insertar columna en su posición original
    modifiedData.forEach((row, idx) => {
        row.splice(lastDeleted.index, 0, lastDeleted.data[idx]);
    });
    showMessage(deleteMessage, `✅ Columna '${lastDeleted.name}' restaurada.`, 'success');
    renderTable(modifiedData);
    updateColumnSelects();
});

// Evento para agregar prefijo
addPrefixBtn.addEventListener('click', () => {
    const colIndex = parseInt(prefixColumnSelect.value);
    const prefix = prefixInput.value.trim();
    if (isNaN(colIndex) || prefix === "") {
        showMessage(prefixMessage, '❌ Selecciona una columna válida y escribe un prefijo.', 'danger');
        return;
    }
    const colName = modifiedData[0][colIndex];
    if (!prefixedColumns[colName]) {
        // Guardar estado original
        prefixedColumns[colName] = modifiedData.map(row => row[colIndex]);
    }
    // Agregar prefijo
    modifiedData.forEach((row, idx) => {
        if (idx === 0) return; // Encabezado
        row[colIndex] = prefix + row[colIndex];
    });
    showMessage(prefixMessage, `✅ Prefijo '${prefix}' agregado a la columna '${colName}'.`, 'success');
    renderTable(modifiedData);
});

// Evento para quitar prefijo
removePrefixBtn.addEventListener('click', () => {
    const colIndex = parseInt(prefixColumnSelect.value);
    const prefix = prefixInput.value.trim();
    if (isNaN(colIndex) || prefix === "") {
        showMessage(prefixMessage, '❌ Selecciona una columna válida y escribe un prefijo.', 'danger');
        return;
    }
    const colName = modifiedData[0][colIndex];
    // Verificar si todos los valores empiezan con el prefijo
    let allHavePrefix = true;
    for (let i = 1; i < modifiedData.length; i++) {
        if (!modifiedData[i][colIndex].startsWith(prefix)) {
            allHavePrefix = false;
            break;
        }
    }
    if (!allHavePrefix) {
        showMessage(prefixMessage, `⚠️ No todos los valores en la columna '${colName}' tienen el prefijo '${prefix}'.`, 'warning');
        return;
    }
    if (!prefixedColumns[colName]) {
        // Guardar estado original
        prefixedColumns[colName] = modifiedData.map(row => row[colIndex]);
    }
    // Quitar prefijo
    modifiedData.forEach((row, idx) => {
        if (idx === 0) return; // Encabezado
        row[colIndex] = row[colIndex].substring(prefix.length);
    });
    showMessage(prefixMessage, `✅ Prefijo '${prefix}' eliminado de la columna '${colName}'.`, 'success');
    renderTable(modifiedData);
});

// Evento para revertir prefijo
undoPrefixBtn.addEventListener('click', () => {
    const colIndex = parseInt(prefixColumnSelect.value);
    if (isNaN(colIndex)) {
        showMessage(prefixMessage, '❌ Selecciona una columna válida.', 'danger');
        return;
    }
    const colName = modifiedData[0][colIndex];
    if (!prefixedColumns[colName]) {
        showMessage(prefixMessage, '⚠️ No hay prefijos para revertir en esta columna.', 'warning');
        return;
    }
    // Revertir a estado original
    modifiedData.forEach((row, idx) => {
        row[colIndex] = prefixedColumns[colName][idx];
    });
    delete prefixedColumns[colName];
    showMessage(prefixMessage, `✅ Prefijo revertido para la columna '${colName}'.`, 'success');
    renderTable(modifiedData);
});

// Evento para descargar archivo modificado
downloadBtn.addEventListener('click', () => {
    showLoader(); // Mostrar loader durante la generación del CSV

    let csvContent = "";
    modifiedData.forEach((rowArray) => {
        // Escapar comillas dobles en los valores y delimitar por comas
        let row = rowArray.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",");
        csvContent += row + "\r\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadLink = document.createElement("a");
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;

    // --- AQUÍ SE UTILIZA getFileNameWithoutExtension ---
    const baseName = getFileNameWithoutExtension(fileName);
    downloadLink.download = baseName + ".csv";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    hideLoader(); // Ocultar loader después de la descarga
});
