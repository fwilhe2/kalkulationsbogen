import { writeFile } from "fs/promises";
import { buildSpreadsheet, A1 } from "./dist/spreadsheet.js";

const spreadsheet = [
  [
    "Celsius",
    {
      value: "42.3324",
      valueType: "float",
      cellStyle: "input",
      range: "celsius"
    }
  ],
  [
    "Fahrenheit",
    { functionName: "", arguments: `(celsius * (9/5)) + 32` }
  ],

];

const mySpreadsheet = await buildSpreadsheet(spreadsheet);
await writeFile("mySpreadsheet.fods", mySpreadsheet);