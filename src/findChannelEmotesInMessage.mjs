/**
 * Finds twitch emotes in the provided messages and updates the provided object
 * @param {Object.<string, {ammount: number, realAmmount: number}> | undefined} toUpdate
 * @param {Object.<string, {tier: number, name: string, scale: string, theme_mode: string, format: string}} channelEmotes
 * @param {Array[string, number]} messageEmotes
 *
 */
export default function updateChannelEmotesInMessageIn(
  toUpdate,
  channelEmotes,
  messageEmotes
) {
  if (!messageEmotes) return {};

  Object.entries(messageEmotes).forEach(([emoteId, emotesPos]) => {
    if (channelEmotes[emoteId]) {
      if (toUpdate[emoteId] === undefined) {
        toUpdate[emoteId] = {
          realAmmount: 0,
          ammount: 0,
          data: {
            ...channelEmotes[emoteId],
          },
        };
      }

      toUpdate[emoteId].ammount++;
      toUpdate[emoteId].realAmmount += emotesPos.length;
    }
  });
}
