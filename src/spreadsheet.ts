export type spreadsheetInput = row[];
export type row = cell[];
export type cell = complexCell | formulaCell | string;
export type complexCell = cellWithValue & cellWithRange;
export type formulaCell = cellWithFunction & cellWithRange;
type cellWithValue = {
  value: string; // | number
  valueType?: valueType;
};
type cellWithFunction = {
  functionName: string;
  arguments: string[] | string;
};
type cellWithRange = { range?: string };
export type valueType = "string" | "float" | "date" | "time" | "currency" | "percentage";
export type spreadsheetOutput = string;

/**
 * Build a spreadsheet from data
 * @param spreadsheet list of lists of cells
 * @returns string Flat OpenDocument Spreadsheet document
 */
export async function buildSpreadsheet(spreadsheet: spreadsheetInput): Promise<string> {
  const tableRows = buildTableRows(spreadsheet);
  const namedRanges = buildNamedRanges(spreadsheet);

  return FODS_TEMPLATE.replace("TABLE_ROWS", tableRows).replace("NAMED_RANGES", namedRanges);
}

function buildTableRows(s: spreadsheetInput): string {
  return s.map(mapRows).join("\n");
}

type cellPosition = { rowIndex: number; cellIndex: number };

function buildNamedRanges(s: spreadsheetInput): string {
  const cellsGroupedByNamedRanges = new Map<string, cellPosition[]>();
  s.forEach((r, ri) =>
    r.forEach((c, ci) => {
      const range = typeof c === "string" ? undefined : c.range;
      if (range === undefined) {
        return;
      }
      const group = cellsGroupedByNamedRanges.get(range) ?? [];
      group.push({ rowIndex: ri + 1, cellIndex: ci + 1 });
      cellsGroupedByNamedRanges.set(range, group);
    }),
  );

  /**
   * Address of the smallest rectangle containing all cells of the group.
   * A named range is a single rectangle, so a group which does not fill its
   * bounding box would silently pull in cells the caller never assigned to it.
   */
  function cellRangeAddress(name: string, cells: cellPosition[]): string {
    const firstColumn = Math.min(...cells.map((c) => c.cellIndex));
    const lastColumn = Math.max(...cells.map((c) => c.cellIndex));
    const firstRow = Math.min(...cells.map((c) => c.rowIndex));
    const lastRow = Math.max(...cells.map((c) => c.rowIndex));

    const boundingBoxSize = (lastColumn - firstColumn + 1) * (lastRow - firstRow + 1);
    if (boundingBoxSize !== cells.length) {
      throw new Error(
        `Named range '${name}' is not contiguous: its cells do not fill the rectangle ${A1(firstColumn, firstRow)}:${A1(lastColumn, lastRow)}. A named range must cover a full rectangle of cells.`,
      );
    }

    if (cells.length == 1) {
      return `.${A1(firstColumn, firstRow, "columnAndRow")}`;
    }
    return `.${A1(firstColumn, firstRow, "columnAndRow")}:.${A1(lastColumn, lastRow, "columnAndRow")}`;
  }

  const namedRangesXmlStrings = [...cellsGroupedByNamedRanges].map(
    ([name, cells]) =>
      `<table:named-range table:name="${attribute(name)}" table:base-cell-address="$Sheet1.${A1(
        cells[0].cellIndex,
        cells[0].rowIndex,
        "columnAndRow",
      )}" table:cell-range-address="$Sheet1${cellRangeAddress(name, cells)}"/>`,
  );

  return namedRangesXmlStrings.join("\n");
}

/**
 * Wrap a value in a CDATA section, splitting it up where it contains the
 * terminator `]]>` which a single section cannot carry.
 */
function cdata(value: string): string {
  return `<![CDATA[${value.split("]]>").join("]]]]><![CDATA[>")}]]>`;
}

/**
 * Escape a value which is interpolated into an XML attribute
 */
function attribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mapRows(value: row): string {
  return `                <table:table-row>\n${value.map(mapCells).join("")}                </table:table-row>\n`;
}

function mapCells(value: cell): string {
  return `                    ${tableCellElement(value)}\n`;
}

function tableCellElement(cell: cell): string {
  if (typeof cell == "string") {
    return `<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p>${cdata(cell)}</text:p> </table:table-cell>`;
  }

  if ("functionName" in cell) {
    return `<table:table-cell table:formula="of:=${cell.functionName}(${Array.isArray(cell.arguments) ? cell.arguments.join(";") : cell.arguments})" />`;
  }

  if (cell.valueType === "float") {
    return `<table:table-cell office:value="${cell.value}" table:style-name="FLOAT_STYLE" office:value-type="float" calcext:value-type="float" />`;
  }

  if (cell.valueType === "date") {
    return `<table:table-cell office:date-value="${cell.value}" table:style-name="DATE_STYLE" office:value-type="date" calcext:value-type="date" />`;
  }

  if (cell.valueType === "time") {
    // assume hh:mm:ss format for now
    const components = cell.value.split(":");
    if (components.length != 3) {
      console.warn("expected hh:mm:ss format");
    }

    return `<table:table-cell office:time-value="PT${components[0]}H${components[1]}M${components[2]}S" table:style-name="TIME_STYLE" office:value-type="time" calcext:value-type="time" />`;
  }

  if (cell.valueType === "currency") {
    return `<table:table-cell office:value="${cell.value}" table:style-name="EUR_STYLE" office:value-type="currency" office:currency="EUR" calcext:value-type="currency" />`;
  }

  if (cell.valueType === "percentage") {
    return `<table:table-cell office:value="${cell.value}" table:style-name="PERCENTAGE_STYLE" office:value-type="percentage" calcext:value-type="percentage" />`;
  }

  return `<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p>${cdata(cell.value)}</text:p> </table:table-cell>`;
}

type addressAbsolute = "none" | "column" | "row" | "columnAndRow";

/**
 * Return "A1" style cell address given one-indexed column and row number
 * @param column one-indexed column number
 * @param row one-indexed row number
 * @param absolute specify if column, row, both or none are prefixed with '$' to indicate they are absolute
 * @returns String like 'A1' or 'C7'
 */
export function A1(column: number, row: number, absolute: addressAbsolute = "none"): string {
  if (column < 1) {
    throw new Error(`Minimal column value is 1, actual value is ${column}`);
  }
  if (row < 1) {
    throw new Error(`Minimal row value is 1, actual value is ${row}`);
  }
  return `${absolute === "column" || absolute === "columnAndRow" ? "$" : ""}${columnIndex(column)}${absolute === "row" || absolute === "columnAndRow" ? "$" : ""}${row}`;
}

/**
 * Return the spreadsheet column name for a one-indexed column number
 * @param i one-indexed column number
 * @returns String like 'A', 'Z', 'AA' or 'AAA'
 */
export function columnIndex(i: number): string {
  if (i < 1) {
    throw new Error(`Minimal value is 1, actual value is ${i}`);
  }
  // bijective base-26: A..Z, AA..AZ, BA..ZZ, AAA..
  let name = "";
  for (let rest = i; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
  }
  return name;
}

const FODS_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0" xmlns:css3t="http://www.w3.org/TR/css3-text/" xmlns:grddl="http://www.w3.org/2003/g/data-view#" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:formx="urn:openoffice:names:experimental:ooxml-odf-interop:xmlns:form:1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:chart="urn:oasis:names:tc:opendocument:xmlns:chart:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:oooc="http://openoffice.org/2004/calc" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:ooow="http://openoffice.org/2004/writer" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:rpt="http://openoffice.org/2005/report" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:ooo="http://openoffice.org/2004/office" xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dr3d="urn:oasis:names:tc:opendocument:xmlns:dr3d:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0" xmlns:tableooo="http://openoffice.org/2009/table" xmlns:drawooo="http://openoffice.org/2010/draw" xmlns:loext="urn:org:documentfoundation:names:experimental:office:xmlns:loext:1.0" xmlns:dom="http://www.w3.org/2001/xml-events" xmlns:field="urn:openoffice:names:experimental:ooo-ms-interop:xmlns:field:1.0" xmlns:math="http://www.w3.org/1998/Math/MathML" xmlns:form="urn:oasis:names:tc:opendocument:xmlns:form:1.0" xmlns:script="urn:oasis:names:tc:opendocument:xmlns:script:1.0" xmlns:xforms="http://www.w3.org/2002/xforms" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
    <office:automatic-styles>
        <number:number-style style:name="___FLOAT_STYLE" style:volatile="true">
            <number:number number:decimal-places="2" number:min-decimal-places="2" number:min-integer-digits="1" number:grouping="true" />
        </number:number-style>
        <number:number-style style:name="__FLOAT_STYLE">
            <style:text-properties fo:color="#ff0000" />
            <number:text>-</number:text>
            <number:number number:decimal-places="2" number:min-decimal-places="2" number:min-integer-digits="1" number:grouping="true" />
            <style:map style:condition="value()&gt;=0" style:apply-style-name="___FLOAT_STYLE" />
        </number:number-style>
        <style:style style:name="FLOAT_STYLE" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="__FLOAT_STYLE" />
        <number:date-style style:name="__DATE_STYLE">
            <number:year number:style="long" />
            <number:text>-</number:text>
            <number:month number:style="long" />
            <number:text>-</number:text>
            <number:day number:style="long" />
        </number:date-style>
        <style:style style:name="DATE_STYLE" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="__DATE_STYLE" />
        <number:time-style style:name="__TIME_STYLE">
            <number:hours number:style="long" />
            <number:text>:</number:text>
            <number:minutes number:style="long" />
            <number:text>:</number:text>
            <number:seconds number:style="long" />
        </number:time-style>
        <style:style style:name="TIME_STYLE" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="__TIME_STYLE" />
        <number:currency-style style:name="___EUR_STYLE" style:volatile="true" number:language="en" number:country="DE">
            <number:number number:decimal-places="2" number:min-decimal-places="2" number:min-integer-digits="1" number:grouping="true" />
            <number:text />
            <number:currency-symbol number:language="de" number:country="DE">€</number:currency-symbol>
        </number:currency-style>
        <number:currency-style style:name="__EUR_STYLE" number:language="en" number:country="DE">
            <style:text-properties fo:color="#ff0000" />
            <number:text>-</number:text>
            <number:number number:decimal-places="2" number:min-decimal-places="2" number:min-integer-digits="1" number:grouping="true" />
            <number:text />
            <number:currency-symbol number:language="de" number:country="DE">€</number:currency-symbol>
            <style:map style:condition="value()&gt;=0" style:apply-style-name="___EUR_STYLE" />
        </number:currency-style>
        <style:style style:name="EUR_STYLE" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="__EUR_STYLE" />
        <number:percentage-style style:name="__PERCENTAGE_STYLE">
            <number:number number:decimal-places="2" number:min-decimal-places="2" number:min-integer-digits="1" />
            <number:text>%</number:text>
        </number:percentage-style>
        <style:style style:name="PERCENTAGE_STYLE" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="__PERCENTAGE_STYLE" />
    </office:automatic-styles>
    <office:body>
        <office:spreadsheet>
            <table:table table:name="Sheet1">
TABLE_ROWS
            </table:table>
            <table:named-expressions>
NAMED_RANGES
            </table:named-expressions>
        </office:spreadsheet>
    </office:body>
</office:document>`;
