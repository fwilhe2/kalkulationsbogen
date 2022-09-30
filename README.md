<p align="center">
    <b>Kalkulationsbogen</b> <i>Spreadsheet builder for nodejs written in TypeScript</i>
    <br>
    <br>
    <a href="https://github.com/fwilhe2/kalkulationsbogen/actions">
      <img src="https://github.com/fwilhe2/kalkulationsbogen/workflows/ci/badge.svg?branch=main">
    </a>
    <a href="https://bundlephobia.com/package/kalkulationsbogen">
      <img src="https://img.shields.io/bundlephobia/minzip/kalkulationsbogen">
    </a>
    <a href="https://www.npmjs.com/package/kalkulationsbogen">
      <img src="https://img.shields.io/npm/dw/kalkulationsbogen">
    </a>
    <a href="https://github.com/fwilhe2/kalkulationsbogen/blob/main/LICENSE">
      <img src="https://img.shields.io/npm/l/kalkulationsbogen">
    </a>
</p>
<p align="center">
  <a href="https://github.com/fwilhe2/kalkulationsbogen">Home</a>
  -
  <a href="https://github.com/fwilhe2/kalkulationsbogen">Documentation</a>
</p>

Kalkulationsbogen is a library for turing data into a spreadsheet.
It is not meant to be a general purpose tool for controlling all aspects of a spreadsheet.
The focus is on a simple and small API.

The motivation to build kalkulationsbogen was that writing out CSV files is simple but the capabilities are very limited.
For example numbers or currency values can't be nicely formatted in CSV files.

For the time being, kalkulationsbogen only supports the Open Document Spreadsheet (`ods`) format.

# Install / Import

```bash
$ npm install --save kalkulationsbogen
```

```typescript
import { buildSpreadsheet } from "kalkulationsbogen";
```

Specific imports:

```typescript
import { buildSpreadsheet } from "kalkulationsbogen/spreadsheet";
```

# Usage

The API provides a single function `buildSpreadsheet` and a few types.
It takes an argument of type `spreadsheetInput` which is an array of _rows_, each _row_ is an array of _cells_.
Cells may take different forms where the most simple one is a plain `string`.
More complex cells are useful if data should be formatted according to its type.
The provided types map to formatting options which are hardcoded in the spreadsheet template for now.

# Examples

## Simple spreadsheet with different data types

```typescript
import { buildSpreadsheet } from "kalkulationsbogen";

const spreadsheet = [
  ["String", "Float", "Date", "Time", "Currency", "Percentage"],
  [
    {
      value: "ABBA",
      valueType: "string",
    },
    {
      value: "42.3324",
      valueType: "float",
    },
    {
      value: "2022-02-02",
      valueType: "date",
    },
    {
      value: "19:03:00",
      valueType: "time",
    },
    {
      value: "2.22",
      valueType: "currency",
    },
    {
      value: "0.4223",
      valueType: "percentage",
    },
  ],
];

const mySpreadsheet = await buildSpreadsheet(spreadsheet);
await writeFile("mySpreadsheet.fods", mySpreadsheet);
```

## Formulas

Formula are represented in cells which take a `functionName` and a `argument` field.
The `arguments` field may be a string if the function takes a single argument, or an array if it takes multiple arguments.

Cell references need to be provided in the "A1" format as in this example:

```typescript
[
  [
    { value: "1.0", valueType: "float" },
    { value: "2.0", valueType: "float" },
    { value: "3.0", valueType: "float" },
  ],
  [
    { functionName: "SUM", arguments: "[.A1:.C1]" },
    { functionName: "AVERAGE", arguments: "[.A1:.C1]" },
    { functionName: "MIN", arguments: "[.A1:.C1]" },
  ],
  [
    { value: "1.1111111", valueType: "float" },
    { functionName: "ROUND", arguments: ["[.A3]", "1"] },
  ],
  [
    { value: "9.9876", valueType: "float" },
    { functionName: "ROUND", arguments: ["[.A4]", "1"] },
  ],
  [{ functionName: "ARABIC", arguments: "&quot;MCMIII&quot;" }],
];
```
