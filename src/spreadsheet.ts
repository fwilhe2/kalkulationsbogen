export type spreadsheetInput = row[];
export type row = cell[];
export type cell = complexCell | formulaCell | string;
export type complexCell = cellWithValue & cellWithRange;
export type formulaCell = cellWithFunction & cellWithRange;
export type cellStyle = "input" | "calculated";
type cellWithValue = {
  value: string; // | number
  valueType?: valueType;
  cellStyle?: cellStyle;
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

function buildNamedRanges(s: spreadsheetInput): string {
  const rangeNamesIndexed = s.flatMap((r, ri) =>
    r.map((c, ci) => {
      return { range: typeof c === "string" ? undefined : c.range, rowIndex: ri + 1, cellIndex: ci + 1 };
    }),
  );

  // via mdn: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce#grouping_objects_by_a_property
  function groupBy(objectArray: any[], property: string) {
    return objectArray.reduce((acc, obj) => {
      const key = obj[property];
      const curGroup = acc[key] ?? [];

      return { ...acc, [key]: [...curGroup, obj] };
    }, {});
  }

  const cellsGroupedByNamedRanges = groupBy(rangeNamesIndexed, "range");

  const namedRanges = Object.keys(cellsGroupedByNamedRanges).filter((x) => x !== "undefined");

  function cellRangeAddress(arr: any[]): string {
    if (arr.length == 1) {
      return `.${A1(arr[0].cellIndex, arr[0].rowIndex, "columnAndRow")}`;
    }
    return `.${A1(arr[0].cellIndex, arr[0].rowIndex, "columnAndRow")}:.${A1(arr[arr.length - 1].cellIndex, arr[arr.length - 1].rowIndex, "columnAndRow")}`;
  }

  const namedRangesXmlStrings = namedRanges.map(
    (r) =>
      `<table:named-range table:name="${r}" table:base-cell-address="$Sheet1.${A1(
        cellsGroupedByNamedRanges[r][0].cellIndex,
        cellsGroupedByNamedRanges[r][0].rowIndex,
        "columnAndRow",
      )}" table:cell-range-address="$Sheet1${cellRangeAddress(cellsGroupedByNamedRanges[r])}"/>`,
  );

  return namedRangesXmlStrings.join("\n");
}

function mapRows(value: row): string {
  return `                <table:table-row>\n${value.map(mapCells).join("")}                </table:table-row>\n`;
}

function mapCells(value: cell): string {
  return `                    ${tableCellElement(value)}\n`;
}

function cellStyleToStyleName(style?: cellStyle): string {
  switch (style) {
    case "calculated":
      return "_CALCULATED";
    case "input":
      return "_INPUT";
    default:
      return "";
  }
}

function tableCellElement(cell: cell): string {
  if (typeof cell == "string") {
    return `<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p><![CDATA[${cell}]]></text:p> </table:table-cell>`;
  }

  if ("functionName" in cell) {
    return `<table:table-cell table:formula="of:=${cell.functionName}(${Array.isArray(cell.arguments) ? cell.arguments.join(";") : cell.arguments})" table:style-name="CALCULATED_STYLE" />`;
  }

  if (cell.valueType === "float") {
    return `<table:table-cell office:value="${cell.value}" table:style-name="FLOAT${cellStyleToStyleName(cell.cellStyle)}_STYLE" office:value-type="float" calcext:value-type="float" />`;
  }

  if (cell.valueType === "date") {
    return `<table:table-cell office:date-value="${cell.value}" table:style-name="DATE${cellStyleToStyleName(cell.cellStyle)}_STYLE" office:value-type="date" calcext:value-type="date" />`;
  }

  if (cell.valueType === "time") {
    // assume hh:mm:ss format for now
    const components = cell.value.split(":");
    if (components.length != 3) {
      console.warn("expected hh:mm:ss format");
    }

    return `<table:table-cell office:time-value="PT${components[0]}H${components[1]}M${components[2]}S" table:style-name="TIME${cellStyleToStyleName(cell.cellStyle)}_STYLE" office:value-type="time" calcext:value-type="time" />`;
  }

  if (cell.valueType === "currency") {
    return `<table:table-cell office:value="${cell.value}" table:style-name="EUR${cellStyleToStyleName(cell.cellStyle)}_STYLE" office:value-type="currency" office:currency="EUR" calcext:value-type="currency" />`;
  }

  if (cell.valueType === "percentage") {
    return `<table:table-cell office:value="${cell.value}" table:style-name="PERCENTAGE${cellStyleToStyleName(cell.cellStyle)}_STYLE" office:value-type="percentage" calcext:value-type="percentage" />`;
  }

  return `<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p><![CDATA[${cell.value}]]></text:p> </table:table-cell>`;
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

export function columnIndex(i: number): string {
  if (i < 1) {
    throw new Error(`Minimal value is 1, actual value is ${i}`);
  }
  return String.fromCharCode(64 + i);
}

const FODS_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0" xmlns:css3t="http://www.w3.org/TR/css3-text/" xmlns:grddl="http://www.w3.org/2003/g/data-view#" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:formx="urn:openoffice:names:experimental:ooxml-odf-interop:xmlns:form:1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:chart="urn:oasis:names:tc:opendocument:xmlns:chart:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:oooc="http://openoffice.org/2004/calc" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:ooow="http://openoffice.org/2004/writer" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:rpt="http://openoffice.org/2005/report" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:ooo="http://openoffice.org/2004/office" xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dr3d="urn:oasis:names:tc:opendocument:xmlns:dr3d:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0" xmlns:tableooo="http://openoffice.org/2009/table" xmlns:drawooo="http://openoffice.org/2010/draw" xmlns:loext="urn:org:documentfoundation:names:experimental:office:xmlns:loext:1.0" xmlns:dom="http://www.w3.org/2001/xml-events" xmlns:field="urn:openoffice:names:experimental:ooo-ms-interop:xmlns:field:1.0" xmlns:math="http://www.w3.org/1998/Math/MathML" xmlns:form="urn:oasis:names:tc:opendocument:xmlns:form:1.0" xmlns:script="urn:oasis:names:tc:opendocument:xmlns:script:1.0" xmlns:xforms="http://www.w3.org/2002/xforms" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
    <office:automatic-styles>

        <!-- Plain data-types styles -->
        <!-- FLOAT -->
        <number:number-style style:name="___FLOAT_STYLE" style:volatile="true">
            <number:number number:decimal-places="2" number:min-decimal-places="2"
                number:min-integer-digits="1" number:grouping="true" />
        </number:number-style>
        <number:number-style style:name="__FLOAT_STYLE">
            <style:text-properties fo:color="#ff0000" />
            <number:text>-</number:text>
            <number:number number:decimal-places="2" number:min-decimal-places="2"
                number:min-integer-digits="1" number:grouping="true" />
            <style:map style:condition="value()&gt;=0" style:apply-style-name="___FLOAT_STYLE" />
        </number:number-style>
        <style:style style:name="FLOAT_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__FLOAT_STYLE">
        </style:style>

        <!-- DATE -->
        <number:date-style style:name="__DATE_STYLE">
            <number:year number:style="long" />
            <number:text>-</number:text>
            <number:month number:style="long" />
            <number:text>-</number:text>
            <number:day number:style="long" />
        </number:date-style>
        <style:style style:name="DATE_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__DATE_STYLE">
        </style:style>

        <!-- TIME -->
        <number:time-style style:name="__TIME_STYLE">
            <number:hours number:style="long" />
            <number:text>:</number:text>
            <number:minutes number:style="long" />
            <number:text>:</number:text>
            <number:seconds number:style="long" />
        </number:time-style>
        <style:style style:name="TIME_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__TIME_STYLE">
        </style:style>

        <!-- CURRENCY -->
        <number:currency-style style:name="___EUR_STYLE" style:volatile="true" number:language="en"
            number:country="DE">
            <number:number number:decimal-places="2" number:min-decimal-places="2"
                number:min-integer-digits="1" number:grouping="true" />
            <number:text />
            <number:currency-symbol number:language="de" number:country="DE">€</number:currency-symbol>
        </number:currency-style>
        <number:currency-style style:name="__EUR_STYLE" number:language="en" number:country="DE">
            <style:text-properties fo:color="#ff0000" />
            <number:text>-</number:text>
            <number:number number:decimal-places="2" number:min-decimal-places="2"
                number:min-integer-digits="1" number:grouping="true" />
            <number:text />
            <number:currency-symbol number:language="de" number:country="DE">€</number:currency-symbol>
            <style:map style:condition="value()&gt;=0" style:apply-style-name="___EUR_STYLE" />
        </number:currency-style>
        <style:style style:name="EUR_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__EUR_STYLE">
        </style:style>

        <!-- PERCENTAGE -->
        <number:percentage-style style:name="__PERCENTAGE_STYLE">
            <number:number number:decimal-places="2" number:min-decimal-places="2"
                number:min-integer-digits="1" />
            <number:text>%</number:text>
        </number:percentage-style>
        <style:style style:name="PERCENTAGE_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__PERCENTAGE_STYLE">
        </style:style>

        <!-- Color-Coding Styles -->
        <style:style style:name="CALCULATED_STYLE" style:family="table-cell">
          <style:table-cell-properties fo:background-color="#f2f2f2" fo:border="0.06pt solid #3f3f3f"/>
        </style:style>

        <style:style style:name="INPUT_STYLE" style:family="table-cell" style:parent-style-name="Default">
          <style:table-cell-properties fo:background-color="#ffcc99" fo:border="0.06pt solid #7f7f7f"/>
          <style:text-properties fo:color="#3f3f76"/>
        </style:style>


        <!-- Combinations of data-types and color coding -->
        <style:style style:name="PERCENTAGE_INPUT_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__PERCENTAGE_STYLE">
          <style:table-cell-properties fo:background-color="#ffcc99" fo:border="0.06pt solid #7f7f7f"/>
        </style:style>
        <style:style style:name="EUR_INPUT_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__EUR_STYLE">
          <style:table-cell-properties fo:background-color="#ffcc99" fo:border="0.06pt solid #7f7f7f"/>
        </style:style>
        <style:style style:name="TIME_INPUT_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__TIME_STYLE">
          <style:table-cell-properties fo:background-color="#ffcc99" fo:border="0.06pt solid #7f7f7f"/>
        </style:style>
        <style:style style:name="DATE_INPUT_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__DATE_STYLE">
          <style:table-cell-properties fo:background-color="#ffcc99" fo:border="0.06pt solid #7f7f7f"/>
        </style:style>
        <style:style style:name="FLOAT_INPUT_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__FLOAT_STYLE">
          <style:table-cell-properties fo:background-color="#ffcc99" fo:border="0.06pt solid #7f7f7f"/>
        </style:style>


        <style:style style:name="PERCENTAGE_CALCULATED_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__PERCENTAGE_STYLE">
          <style:table-cell-properties fo:background-color="#f2f2f2" fo:border="0.06pt solid #3f3f3f"/>
        </style:style>
        <style:style style:name="EUR_CALCULATED_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__EUR_STYLE">
          <style:table-cell-properties fo:background-color="#f2f2f2" fo:border="0.06pt solid #3f3f3f"/>
        </style:style>
        <style:style style:name="TIME_CALCULATED_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__TIME_STYLE">
          <style:table-cell-properties fo:background-color="#f2f2f2" fo:border="0.06pt solid #3f3f3f"/>
        </style:style>
        <style:style style:name="DATE_CALCULATED_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__DATE_STYLE">
          <style:table-cell-properties fo:background-color="#f2f2f2" fo:border="0.06pt solid #3f3f3f"/>
        </style:style>
        <style:style style:name="FLOAT_CALCULATED_STYLE" style:family="table-cell"
            style:parent-style-name="Default" style:data-style-name="__FLOAT_STYLE">
          <style:table-cell-properties fo:background-color="#f2f2f2" fo:border="0.06pt solid #3f3f3f"/>
        </style:style>

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
