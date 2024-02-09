/**
 * Finds 7tv emotes in the provided messages and update the provided object
 * @param {Object<string, {ammount: number, realAmmount: number}>} toUpdate
 * @param {Object<string, string>} seventvEmotes A table to get 7tv ids from names
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
    message.split(" ").forEach((part) => {
      let emoteId = seventvEmotes[part];

      if (emoteId) {
        updatedEmotes.push(emoteId);
        if (!toUpdate[emoteId]) {
          toUpdate[emoteId] = {
            __li: i, // Last message index that updated this emote. This will keep the "ammount" field unique
            ammount: 1,
            realAmmount: 0,
          };
        }

        toUpdate[emoteId].realAmmount++;
        if (toUpdate[emoteId].__li !== i) {
          toUpdate[emoteId].ammount++;
          toUpdate[emoteId].__li = i;
        }
      }
    });
  });

  updatedEmotes.forEach((emote) => {
    delete toUpdate[emote].__li;
  });
}
