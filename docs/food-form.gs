/**
 * Builds the phone form for the food log. Paste into the sheet's Extensions → Apps Script,
 * pick `createFoodForm` and press Run once. See docs/food.md → "Logging from your phone".
 *
 * It creates a Google Form whose answers land in a new tab of this spreadsheet, copies
 * your existing rows into that tab, and logs the form's link. Question titles are the
 * sheet's column names, which is what the site's sync reads.
 */

/** The tab your rows are in now. */
const LOG_TAB = "Sheet1";

const PRICES = ["$ (<$20)", "$$ ($20-50)", "$$$ ($50-100)", "$$$$ ($100+)"];
const CUISINES = [
  "Japanese", "Ramen", "Sushi", "Korean", "Chinese", "Dumplings", "Thai", "Vietnamese",
  "Indian", "Italian", "Pizza", "Mexican", "Middle Eastern", "Burgers", "BBQ", "Seafood",
  "Cafe", "Bakery", "Dessert", "Modern Australian", "Bar",
];

function createFoodForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName(LOG_TAB);
  if (!log) throw new Error(`No tab called "${LOG_TAB}". Set LOG_TAB at the top of the script.`);
  const rows = log.getDataRange().getDisplayValues();
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const column = (name) => header.indexOf(name);
  const used = (name) =>
    column(name) === -1 ? [] : rows.slice(1).map((r) => r[column(name)].trim()).filter(Boolean);
  const choices = (...lists) => [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b));

  const form = FormApp.create("Food log");
  form.setDescription("One spot per entry. Only name, city and score are required.");
  form.setConfirmationMessage("Logged. It shows on the site after the next sync.");

  form.addTextItem().setTitle("Name").setRequired(true);
  form.addMultipleChoiceItem().setTitle("City").setRequired(true)
    .setChoiceValues(choices(used("city"), ["Melbourne"])).showOtherOption(true);
  form.addTextItem().setTitle("Score").setRequired(true).setHelpText("0–10, one decimal")
    .setValidation(FormApp.createTextValidation().requireNumberBetween(0, 10)
      .setHelpText("A number from 0 to 10").build());
  form.addTextItem().setTitle("Maps")
    .setHelpText("Google Maps → the place → Share → Copy link. Fills in the pin and the area.");
  form.addMultipleChoiceItem().setTitle("Cuisine")
    .setChoiceValues(choices(used("cuisine"), CUISINES)).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle("Price").setChoiceValues(PRICES);
  form.addParagraphTextItem().setTitle("Dishes")
    .setHelpText("Separate with ;  Tag with [MUST ORDER], [SIGNATURE], [SKIP], [SHARE] or [SPICY]");
  form.addParagraphTextItem().setTitle("Review");
  form.addDateItem().setTitle("Visited").setHelpText("Leave blank if it was today.");
  form.addTextItem().setTitle("Area").setHelpText("Leave blank to take it from the Maps link.");

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // The responses tab appears a moment after linking.
  let responses;
  for (let i = 0; i < 20 && !responses; i++) {
    SpreadsheetApp.flush();
    responses = ss.getSheets().find((s) => {
      const url = s.getFormUrl();
      return url && FormApp.openByUrl(url).getId() === form.getId();
    });
    if (!responses) Utilities.sleep(500);
  }
  if (!responses) throw new Error("The form was made, but its responses tab didn't appear. Copy your rows over by hand.");
  responses.setName("Food log");

  // ISO dates, so the site never has to guess whether 03/04 is March or April.
  const iso = { timestamp: "yyyy-mm-dd hh:mm:ss", visited: "yyyy-mm-dd" };
  const headers = responses.getRange(1, 1, 1, responses.getLastColumn()).getDisplayValues()[0];
  headers.forEach((h, i) => {
    const format = iso[h.trim().toLowerCase()];
    if (format) responses.getRange(2, i + 1, responses.getMaxRows() - 1).setNumberFormat(format);
  });

  // Existing rows go under the form's columns, matched by name. "coords" lands in "maps",
  // which takes either coordinates or a link.
  const target = headers.map((h) => h.trim().toLowerCase());
  const copied = rows.slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r) => target.map((name) => {
      const from = column(name === "maps" ? (column("maps") !== -1 ? "maps" : "coords") : name);
      return from === -1 ? "" : r[from];
    }));
  if (copied.length) {
    // Plain text keeps "2026-03" and "-37.8, 144.9" exactly as written.
    responses.getRange(2, 1, copied.length, target.length).setNumberFormat("@").setValues(copied);
  }

  Logger.log(`Form (bookmark this on your phone): ${form.getPublishedUrl()}`);
  Logger.log(`Copied ${copied.length} rows into the "Food log" tab.`);
  Logger.log('Now publish the "Food log" tab as CSV and update FOOD_SHEET_CSV_URL (docs/food.md).');
}
