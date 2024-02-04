/**
 * Finds 7tv emotes in the provided messages
 * @param {Object.<string, {id: string, name: string, animated: boolean, listed: boolean}} seventvEmotes
 * @param {Object.<string, {ammount: number, realAmmount: number}>} emotesUsed
 * @param {string} message
 * 
 * @return {Object.<string, {ammount: number, realAmmount: number}> | undefined}
 */
export default function find7tvEmotesInMessage(
  seventvEmotes,
  emotesUsed,
  message
) {
  if (!message) return {};
  const newEmotes = false;

  message.split("\r\n").forEach((message, i) => {
    // TODO: Change part for ID
    message.split(" ").forEach((part) => {
      let is7tvEmote = seventvEmotes[part];

      if (is7tvEmote) {
        newEmotes = true;
        if (!emotesUsed[part]) {
          emotesUsed[part] = {
            __li: i, // Last message index that updated this emote. This will keep the "ammount" field unique
            ammount: 1,
            realAmmount: 0,
            data: {
              ...seventvEmotes[part],
            },
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

  if (newEmotes) {
    return Object.fromEntries(
      Object.entries(emotesUsed).map(([k, v]) => {
        delete v.__li;
        return [k, v];
      })
    );
  }
}
