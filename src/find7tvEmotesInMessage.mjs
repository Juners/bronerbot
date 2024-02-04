/**
 * Finds 7tv emotes in the provided messages and update the provided object
 * @param {Object.<string, {ammount: number, realAmmount: number}>} toUpdate
 * @param {Object.<string, {id: string, name: string, animated: boolean, listed: boolean}} seventvEmotes
 * @param {string} message
 */
export default function find7tvEmotesInMessage(
  toUpdate,
  seventvEmotes,
  message
) {
  if (!message) return {};

  const updatedEmotes = [];
  message.split("\r\n").forEach((message, i) => {
    // TODO: Change part for ID
    message.split(" ").forEach((part) => {
      let is7tvEmote = seventvEmotes[part];

      if (is7tvEmote) {
        updatedEmotes.push(part);
        if (!toUpdate[part]) {
          toUpdate[part] = {
            __li: i, // Last message index that updated this emote. This will keep the "ammount" field unique
            ammount: 1,
            realAmmount: 0,
            data: {
              ...seventvEmotes[part],
            },
          };
        }

        toUpdate[part].realAmmount++;
        if (toUpdate[part].__li !== i) {
          toUpdate[part].ammount++;
          toUpdate[part].__li = i;
        }
      }
    });
  });

  updatedEmotes.forEach((emote) => {
    delete toUpdate[emote].__li;
  });
}
