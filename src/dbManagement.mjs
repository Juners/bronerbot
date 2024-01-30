import {
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

/**
 *
 * @param {DynamoDBClient} client
 * @param {bool} isLive
 * @returns
 */
async function writeEmoteUsage(client, date, emotes) {
  try {
    const id = crypto.randomBytes(16).toString("hex");
    const params = {
      TableName: "lina_emotes_data",
      Item: {
        uuid: {
          S: id,
        },
        date: {
          N: date,
        },
        json: {
          S: emotes,
        },
      },
    };

    const putCommand = new PutItemCommand(params);
    await client.send(putCommand);

    return true;
  } catch (e) {
    console.error("writeEmoteUsage", e);
    return null;
  }
}

export async function getEmoteUsage() {}

export async function updateEmoteUsage(emoteUsage, date) {
  console.log(JSON.stringify(emoteUsage));

  const promise = new Promise((resolve, reject) => {
    const client = new DynamoDBClient({ region: "eu-west-1" });
    const success = writeEmoteUsage(client, date, emoteUsage);
    client.destroy();

    if (success) {
      resolve();
    } else {
      reject();
    }
  });

  return promise;
}

export async function getStoredEmoteData() {
  const client = new DynamoDBClient({ region: "eu-west-1" });

  try {
    const scanCommand = new ScanCommand({
      TableName: "lina_emotes_data",
      Limit: 1,
      ScanIndexForward: false,
    });

    const item = (await client.send(scanCommand)).Items[0];
    const emoteData = { date: item.date.N, json: item.json.S };

    return JSON.parse(emoteData.json);
  } catch (e) {
    console.error("getStoredEmoteData", e);
    return JSON.stringify(e, null, 2);
  }
}
