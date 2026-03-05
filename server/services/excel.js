const XLSX = require('xlsx');

/**
 * Extract structured data from an Excel file
 */
function extractExcelData(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheets = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const csvData = XLSX.utils.sheet_to_csv(worksheet);

    // Get headers (first row)
    const headers = jsonData[0] || [];
    const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));

    sheets.push({
      name: sheetName,
      headers,
      rows,
      csv: csvData,
      rowCount: rows.length,
      colCount: headers.length,
    });
  }

  return { sheets };
}

/**
 * Convert Excel data to text for LLM processing
 */
function excelToText(excelData) {
  let text = '';
  for (const sheet of excelData.sheets) {
    text += `=== Sheet: ${sheet.name} ===\n`;
    text += `Columns: ${sheet.headers.join(', ')}\n`;
    text += `Rows: ${sheet.rowCount}\n\n`;
    text += sheet.csv + '\n\n';
  }
  return text;
}

module.exports = { extractExcelData, excelToText };
