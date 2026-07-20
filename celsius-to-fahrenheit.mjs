import { writeFile } from "fs/promises";
import { buildSpreadsheet, A1 } from "./dist/spreadsheet.js";

const spreadsheet = [
  ["Temperature unit converter"],
  [
    "°C",
    {
      value: "42.3324",
      valueType: "float",
      cellStyle: "input",
      range: "celsius"
    }
  ],
  [
    "°F",
    { functionName: "", arguments: `(celsius * (9/5)) + 32` }
  ],
  [],
  [
    "°F",
    {
      value: "42.3324",
      valueType: "float",
      cellStyle: "input",
      range: "fahrenheit"
    }
  ],
  [
    "°C",
    { functionName: "", arguments: `(fahrenheit - 32) * (5/9)` }
  ],

];

const mySpreadsheet = await buildSpreadsheet(spreadsheet);
await writeFile("mySpreadsheet.fods", mySpreadsheet);