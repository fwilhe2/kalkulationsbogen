import { expect, test } from "@jest/globals";
import { exec } from "child_process";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { promisify } from "util";
import { buildSpreadsheet, spreadsheetInput, columnIndex, A1 } from "../src";

describe("Unit tests", () => {
  test("buildSpreadsheet creates expected cells", async () => {
    const input: spreadsheetInput = [
      ["a", "b", "c"],
      [
        { value: "1", valueType: "float" },
        { value: "2", valueType: "float", range: "FOO_RANGE" },
        { value: "3", valueType: "float" },
      ],
      [
        { value: "1", valueType: "float", range: "BAR_RANGE" },
        { value: "2", valueType: "float", range: "BAR_RANGE" },
        { value: "3", valueType: "float", range: "BAR_RANGE" },
      ],
    ];
    const actual = await buildSpreadsheet(input);
    expect(actual).toMatch('<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p><![CDATA[a]]></text:p> </table:table-cell>');
    expect(actual).toMatch('<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p><![CDATA[b]]></text:p> </table:table-cell>');
    expect(actual).toMatch('<table:table-cell office:value-type="string" calcext:value-type="string"> <text:p><![CDATA[c]]></text:p> </table:table-cell>');
    expect(actual).toMatch('<table:table-cell office:value="1" table:style-name="FLOAT_STYLE" office:value-type="float" calcext:value-type="float" />');
    expect(actual).toMatch('<table:table-cell office:value="2" table:style-name="FLOAT_STYLE" office:value-type="float" calcext:value-type="float" />');
    expect(actual).toMatch('<table:table-cell office:value="3" table:style-name="FLOAT_STYLE" office:value-type="float" calcext:value-type="float" />');
    expect(actual).toMatch('<table:named-range table:name="FOO_RANGE" table:base-cell-address="$Sheet1.$B$2" table:cell-range-address="$Sheet1.$B$2"/>');
    expect(actual).toMatch('<table:named-range table:name="BAR_RANGE" table:base-cell-address="$Sheet1.$A$3" table:cell-range-address="$Sheet1.$A$3:.$C$3"/>');
  });

  test("column index", async () => {
    expect(columnIndex(1)).toEqual("A");
    expect(columnIndex(2)).toEqual("B");
    expect(columnIndex(3)).toEqual("C");
    expect(columnIndex(4)).toEqual("D");
  });

  test("A1 Addressing", async () => {
    expect(A1(1, 1)).toEqual("A1");
    expect(A1(2, 1)).toEqual("B1");
    expect(A1(3, 1)).toEqual("C1");
    expect(A1(1, 2)).toEqual("A2");
    expect(A1(1, 3)).toEqual("A3");
  });

  test("A1 Addressing absolute", async () => {
    expect(A1(1, 1, "column")).toEqual("$A1");
    expect(A1(2, 1, "row")).toEqual("B$1");
    expect(A1(3, 1, "none")).toEqual("C1");
    expect(A1(1, 2, "columnAndRow")).toEqual("$A$2");
  });
});

describe("Spreadsheet builder", () => {
  beforeAll(async () => {
    await rm("__tests__/output", { recursive: true, force: true });
    await mkdir("__tests__/output");
  });

  async function integrationTest(name: string, actualSpreadsheet: spreadsheetInput, expectedCsv: string) {
    const actualFods = await buildSpreadsheet(actualSpreadsheet);
    await writeFile(`__tests__/output/${name}.fods`, actualFods);

    // todo: see why this did not work using execa

    const e = promisify(exec);
    const p = await e(`libreoffice --headless --convert-to csv:"Text - txt - csv (StarCalc)":"44,34,76,1,,1031,true,true" __tests__/output/${name}.fods --outdir __tests__/output`);

    expect(p.stderr).toEqual("");

    const actualCsv = (await readFile(`__tests__/output/${name}.csv`)).toString();
    expect(actualCsv).toEqual(expectedCsv);
  }

  test("Creating a spreadsheet which can be opened using libreoffice - check the csv output is identical", async () => {
    const expectedCsv = `"String","Float","Date","Time","Currency","Currency with Cents","Percentage"\n"ABBA",42.33,2022-02-02,19:03:00,3.00€,2.22€,42.23%\n`;

    const spreadsheet = JSON.parse((await readFile("__tests__/data-formats.json")).toString());
    await integrationTest("common-data-formats", spreadsheet, expectedCsv);
  });

  test("Performance Model Spreadsheet", async () => {
    const expectedCsv = `"Number of CPUs","Parallel Computing Time","Sequential Computing Time","Speedup","Efficiency"\n4.00,"25,800.00","100,000.00",3.88,0.97\n5.00,"21,000.00","100,000.00",4.76,0.95\n6.00,"17,866.67","100,000.00",5.60,0.93\n`;
    const problemSizeX = 100;
    const problemSizeY = 100;
    const calculationTimePerCell = 10;
    const numberOfOperations = 1;
    const communicationTimePerCell = 200;
    const mySpreadsheet: spreadsheetInput = [["Number of CPUs", "Parallel Computing Time", "Sequential Computing Time", "Speedup", "Efficiency"]];
    for (let numberOfCpus = 4; numberOfCpus < 7; numberOfCpus++) {
      const timeParallel = (problemSizeX / numberOfCpus) * problemSizeY * calculationTimePerCell * numberOfOperations + communicationTimePerCell * numberOfCpus;
      const timeSequential = problemSizeX * problemSizeY * calculationTimePerCell * numberOfOperations;
      const speedup = timeSequential / timeParallel;
      mySpreadsheet.push([
        {
          value: numberOfCpus.toString(),
          valueType: "float",
        },
        {
          value: `${timeParallel}`,
          valueType: "float",
        },
        {
          value: `${timeSequential}`,
          valueType: "float",
        },
        {
          value: `${speedup}`,
          valueType: "float",
        },
        {
          value: `${speedup / numberOfCpus}`,
          valueType: "float",
        },
      ]);
    }
    await integrationTest("performance-model", mySpreadsheet, expectedCsv);
  });

  test("CDATA needs to be escaped", async () => {
    const expectedCsv = `"<xml is=""a thing"">","foo & bar"\n`;

    const spreadsheet = [['<xml is="a thing">', "foo & bar"]];
    await integrationTest("cdata", spreadsheet, expectedCsv);
  });

  test("Formula", async () => {
    const expectedCsv = `1.00,2.00,3.00\n6,2,1\n1.11,1.1,\n9.99,10,\n1903,,\n`;

    const spreadsheet: spreadsheetInput = [
      [
        { value: "1.0", valueType: "float" },
        { value: "2.0", valueType: "float" },
        { value: "3.0", valueType: "float" },
      ],
      [
        { functionName: "SUM", arguments: `[.${A1(1, 1)}:.${A1(3, 1)}]` },
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
    await integrationTest("formula", spreadsheet, expectedCsv);
  });

  test("relative and absolute addresses", async () => {
    const expectedCsv = "10.00,50.00,50,50,50,50\n13.30,55.94,55.94,55.94,55.94,55.94\n25.00,77.00,77,77,77,77\n32.00,89.60,89.6,89.6,89.6,89.6\n";

    // Assume those are measurement values which we want to convert to another unit (celsius to fahrenheit)
    const degreesInCelsius = [10, 13.3, 25, 32];

    // Spreadsheet where the conversion is done in different ways
    const spreadsheet: spreadsheetInput = degreesInCelsius.map((d, index) => [
      { value: `${d}`, valueType: "float", range: "celsius" }, // original value (celsius)
      { value: `${d * 1.8 + 32}`, valueType: "float" }, // conversion done in js
      { functionName: "", arguments: `A${index + 1}*1.8+32` }, // conversion done in formula using relative address
      { functionName: "", arguments: `$A${index + 1}*1.8+32` }, // conversion done in formula using absolute column address
      { functionName: "", arguments: `$A$${index + 1}*1.8+32` }, // conversion done in formula using absolute address
      { functionName: "", arguments: `celsius*1.8+32` }, // conversion done in formula using named range
    ]);

    await integrationTest("celsius-to-fahrenheit", spreadsheet, expectedCsv);
  });

  test("Data table formula with column sums and row averages", async () => {
    const expectedCsv = `" ","2020","2021","2022","avg"\n"a",27.00€,36.00€,49.00€,37.33€\n"b",9.00€,14.00€,10.00€,11.00€\n"c",3.00€,5.00€,10.00€,6.00€\n"sum",39.00€,55.00€,69.00€,\n`;

    // x   x   x   avg
    // x   x   x   avg
    // sum sum sum

    const spreadsheet: spreadsheetInput = [
      [" ", "2020", "2021", "2022", "avg"],
      ["a", { value: "27", valueType: "currency" }, { value: "36", valueType: "currency" }, { value: "49", valueType: "currency" }, { functionName: "AVERAGE", arguments: "[.B2:.D2]" }],
      ["b", { value: "9", valueType: "currency" }, { value: "14", valueType: "currency" }, { value: "10", valueType: "currency" }, { functionName: "AVERAGE", arguments: "[.B3:.D3]" }],
      ["c", { value: "3", valueType: "currency" }, { value: "5", valueType: "currency" }, { value: "10", valueType: "currency" }, { functionName: "AVERAGE", arguments: "[.B4:.D4]" }],
      ["sum", { functionName: "SUM", arguments: "[.B2:.B4]" }, { functionName: "SUM", arguments: "[.C2:.C4]" }, { functionName: "SUM", arguments: "[.D2:.D4]" }],
    ];

    await integrationTest("formula-data-table", spreadsheet, expectedCsv);
  });

  test("Data table formula with row averages where rows have different number of cells", async () => {
    const expectedCsv = "27.00€,36.00€,49.00€,37.33€,,\n9.00€,14.00€,10.00€,13.00€,20.00€,13.20€\n3.00€,10.00€,6.50€,,,\n";

    const input: spreadsheetInput = [
      [
        { value: "27", valueType: "currency" },
        { value: "36", valueType: "currency" },
        { value: "49", valueType: "currency" },
      ],
      [
        { value: "9", valueType: "currency" },
        { value: "14", valueType: "currency" },
        { value: "10", valueType: "currency" },
        { value: "13", valueType: "currency" },
        { value: "20", valueType: "currency" },
      ],
      [
        { value: "3", valueType: "currency" },
        { value: "10", valueType: "currency" },
      ],
    ];

    const spreadsheet: spreadsheetInput = input.map((row, ri, rows) => [...row, { functionName: "AVERAGE", arguments: `[.${A1(1, ri + 1)}:.${A1(rows[ri].length, ri + 1)}]` }]);

    await integrationTest("formula-data-table-different-number-of-cells", spreadsheet, expectedCsv);
  });

  test("Dynamic data table formula with column sums and row averages", async () => {
    const expectedCsv = `27.00€,36.00€,49.00€,37.33€\n9.00€,14.00€,10.00€,11.00€\n3.00€,5.00€,10.00€,6.00€\n7.00€,9.00€,14.00€,10.00€\n46.00€,64.00€,83.00€,64.33€\n`;

    const input: spreadsheetInput = [
      [
        { value: "27", valueType: "currency" },
        { value: "36", valueType: "currency" },
        { value: "49", valueType: "currency" },
      ],
      [
        { value: "9", valueType: "currency" },
        { value: "14", valueType: "currency" },
        { value: "10", valueType: "currency" },
      ],
      [
        { value: "3", valueType: "currency" },
        { value: "5", valueType: "currency" },
        { value: "10", valueType: "currency" },
      ],
      [
        { value: "7", valueType: "currency" },
        { value: "9", valueType: "currency" },
        { value: "14", valueType: "currency" },
      ],
    ];

    const sumRow = input.map((_, ri, rs) => {
      return { functionName: "SUM", arguments: `[.${A1(ri + 1, 1, "row")}:.${A1(ri + 1, rs.length)}]` };
    });
    const spreadsheet: spreadsheetInput = input
      .map((row, ri, rows) => [...row, { functionName: "AVERAGE", arguments: `[.${A1(1, ri + 1, "column")}:.${A1(rows[ri].length, ri + 1)}]` }])
      .concat([sumRow]);

    await integrationTest("formula-data-table-dynamic", spreadsheet, expectedCsv);
  });

  test("named ranges", async () => {
    const expectedCsv = `1.00,1.00,1.00\n2.00,3.00,\n3,5,\n`;

    const spreadsheet: spreadsheetInput = [
      [
        { value: "1", range: "one", valueType: "float" },
        { value: "1", range: "one", valueType: "float" },
        { value: "1", range: "one", valueType: "float" },
      ],
      [
        { value: "2", range: "two", valueType: "float" },
        { value: "3", range: "three", valueType: "float" },
      ],
      [
        {
          functionName: "SUM",
          arguments: "one",
        },
        {
          functionName: "",
          arguments: "two + three",
        },
      ],
    ];

    await integrationTest("range-name", spreadsheet, expectedCsv);
  });

  test("Performance Model Spreadsheet with named ranges", async () => {
    const expectedCsv = `"Problem Size X",100,"Problem Size Y",100,"Compute Time per Cell",10,"Number of Ops",1,"Communication Time per Cell",200\n"Number of CPUs","Parallel Computing Time","Sequential Computing Time","Speedup","Efficiency",,,,,\n4.00,25800,100000,3.87596899224806,0.968992248062015,,,,,\n5.00,21000,100000,4.76190476190476,0.952380952380952,,,,,\n6.00,17866.6666666667,100000,5.59701492537313,0.932835820895522,,,,,\n`;

    const mySpreadsheet: spreadsheetInput = [
      [
        "Problem Size X",
        { range: "problemSizeX", value: "100", valueType: "float", isInputCell: true },
        "Problem Size Y",
        { range: "problemSizeY", value: "100", valueType: "float", isInputCell: true },
        "Compute Time per Cell",
        { range: "calculationTimePerCell", value: "10", valueType: "float", isInputCell: true },
        "Number of Ops",
        { range: "numberOfOperations", value: "1", valueType: "float", isInputCell: true },
        "Communication Time per Cell",
        { range: "communicationTimePerCell", value: "200", valueType: "float", isInputCell: true },
      ],
      ["Number of CPUs", "Parallel Computing Time", "Sequential Computing Time", "Speedup", "Efficiency"],
    ];
    for (let numberOfCpus = 4; numberOfCpus < 7; numberOfCpus++) {
      mySpreadsheet.push([
        {
          range: "numberOfCpus",
          value: numberOfCpus.toString(),
          valueType: "float",
        },
        {
          range: "timeParallel",
          functionName: "",
          arguments: "(problemSizeX/numberOfCpus)*problemSizeY*calculationTimePerCell*numberOfOperations+communicationTimePerCell*numberOfCpus",
        },
        {
          range: "timeSequential",
          functionName: "",
          arguments: "problemSizeX*problemSizeY*calculationTimePerCell*numberOfOperations",
        },
        {
          range: "speedup",
          functionName: "",
          arguments: "timeSequential/timeParallel",
        },
        {
          range: "efficiency",
          functionName: "",
          arguments: "speedup/numberOfCpus",
        },
      ]);
    }

    await integrationTest("performance-model-named-ranges", mySpreadsheet, expectedCsv);
  });
});
