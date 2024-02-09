/**
 * Finds twitch emotes in the provided messages and updates the provided object
 * @param {Object<string, {ammount: number, realAmmount: number}> | undefined} toUpdate
 * @param {Array<string>} channelEmotes
 * @param {Object<string, Array<{startPosition: number, endPosition: number}>>} messageTagEmotes
 *
 */
export default function updateChannelEmotesInMessageIn(
  toUpdate,
  channelEmotes,
  messageTagEmotes
) {
  if (!messageTagEmotes) return {};

  Object.entries(messageTagEmotes).forEach(([emoteId, emotePositions]) => {
    if (channelEmotes[emoteId]) {
      if (toUpdate[emoteId] === undefined) {
        toUpdate[emoteId] = {
          realAmmount: 0,
          ammount: 0,
        };
      }

      toUpdate[emoteId].ammount++;
      toUpdate[emoteId].realAmmount += emotePositions.length;
    }
  });
}
