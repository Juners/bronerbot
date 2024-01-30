/**
 * Finds 7tv emotes in the provided messages
 * @param {Object.<string, {name: string, name: string, animated: boolean, listed: boolean}} seventvEmotes
 * @param {Object.<string, {ammount: number, realAmmount: number}>} emotesUsed
 * @param {string} message
 */
export default function find7tvEmotesInMessage(
  seventvEmotes,
  emotesUsed,
  message
) {
  if (!message) return {};

  message.split("\r\n").forEach((message, i) => {
    message.split(" ").forEach((part) => {
      let is7tvEmote = seventvEmotes[part];

      if (is7tvEmote) {
        if (!emotesUsed[part]) {
          emotesUsed[part] = {
            __li: i, // Last message index that updated this emote. This will keep the "ammount" field unique
            ammount: 1,
            realAmmount: 0,
          };
        }

        emotesUsed[part].realAmmount++;
        if (emotesUsed[part].__li !== i) {
          emotesUsed[part].ammount++;
          emotesUsed[part].__li = i;
        }
      }
    });
  });

  return emotesUsed;
}
