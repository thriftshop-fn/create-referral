if (!process.env.NETLIFY) {
  require("dotenv").config();
}

const { GoogleSpreadsheet } = require("google-spreadsheet");

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SPREADSHEET_ID_FROM_URL,
} = process.env;

if (!GOOGLE_SERVICE_ACCOUNT_EMAIL)
  throw new Error("no GOOGLE_SERVICE_ACCOUNT_EMAIL env var set");
if (!GOOGLE_PRIVATE_KEY) throw new Error("no GOOGLE_PRIVATE_KEY env var set");
if (!GOOGLE_SPREADSHEET_ID_FROM_URL)
  throw new Error("no GOOGLE_SPREADSHEET_ID_FROM_URL env var set");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: "Method Not Allowed!",
      }),
      headers: { Allow: "POST" },
    };
  }

  let validationError = [];

  const referral_types = ["fixed", "percent"];

  const {
    username = null,
    name = null,
    email = null,
    type = "percent",
    amount = "10",
    active = false,
  } = JSON.parse(event.body);

  if (!username) {
    let error = {
      field: "username",
      message: "No Username Submitted",
    };
    validationError.push(error);
  }

  if (!email) {
    let error = {
      field: "email",
      message: "No Email Submitted",
    };
    validationError.push(error);
  }

  if (!name) {
    let error = {
      field: "name",
      message: "No Name Submitted",
    };
    validationError.push(error);
  }

  if (!referral_types.includes(type)) {
    let error = {
      field: "type",
      message: "Referral Commission Type is Invalid!",
    };
    validationError.push(error);
  }

  if (validationError.length > 0) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        errors: validationError,
      }),
    };
  }

  try {
    const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID_FROM_URL);

    await doc.useServiceAccountAuth({
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    await doc.loadInfo();

    var referral_sheet = doc.sheetsById[2];

    if (!referral_sheet) {
      await doc.addSheet({
        headerValues: [
          "referral_code",
          "name",
          "email",
          "type",
          "amount",
          "active",
          "commission",
        ],
      });
      referral_sheet = doc.sheetsById[2];
      await referral_sheet.updateProperties({
        title: "Referrals",
      });
    }

    try {
      await referral_sheet.loadHeaderRow();
    } catch (e) {
      await referral_sheet.updateProperties({
        title: "Referrals",
      });
      await referral_sheet.setHeaderRow([
        "referral_code",
        "name",
        "email",
        "type",
        "amount",
        "active",
        "commission",
      ]);
    }

    const rows = await referral_sheet.getRows();

    if (referral_sheet.rowCount > 0) {
      const rowIndex = rows.findIndex((x) => x.referral_code == username);

      if (rowIndex > -1) {
        let error = {
          statusCode: 400,
          body: JSON.stringify({
            error: "Referral Account Record Already Exist!",
          }),
        };
        return error;
      }
    }

    await referral_sheet.addRow({
      referral_code: username,
      name,
      type,
      active,
      email,
      amount,
      commission: 0,
    });

    let message = "Please Wait For Us To Approved Your Application";
    if (active || active == "true" || active == true) {
      message = "You Have Successfully Join Our Referral Program!";
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        message,
      }),
    };
  } catch (e) {
    console.log(e.toString());
    return {
      statusCode: 500,
      body: e.toString(),
    };
  }
};
