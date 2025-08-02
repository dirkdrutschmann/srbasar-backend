const axios = require("axios"); // Importing axios for making HTTP requests
const { mail, getEmailText } = require("../_mailer/mailer"); // Importing mail and getEmailText from mailer
const { Liga, Match, User } = require("../_models"); // Importing Liga, Match, User models

// Dynamischer Import für ES6-Modul
let BasketballBundSDK;
(async () => {
  const { BasketballBundSDK: SDK } = await import("basketball-bund-sdk");
  BasketballBundSDK = SDK;
})();

/**
 * This function updates the leagues data.
 * @param {number} index - The index to start at when fetching the leagues data.
 * @returns {Promise} - A Promise that resolves when the leagues data is updated.
 */
module.exports.updateLigen = async function updateLigen(index = 0) {
  // Warten bis SDK geladen ist
  if (!BasketballBundSDK) {
    const { BasketballBundSDK: SDK } = await import("basketball-bund-sdk");
    BasketballBundSDK = SDK;
  }
  
  const sdk = new BasketballBundSDK();
  const response = await sdk.wam.getLigaList({
    akgGeschlechtIds: [],
    altersklasseIds: [],
    gebietIds: [],
    ligatypIds: [],
    sortBy: 0,
    spielklasseIds: [],
    token: "",
    verbandIds: [3],
    startAtIndex: index,
  });
  if (!response) {
    console.log("No response from getLeagues");
    return;
  }
  try {
    const ligen = response.ligen;
    for (const liga of ligen) {
      if (liga.verbandId !== 30) {
        const league = new Liga(liga);
        await league.save().then(
          (success) => {
            console.log(`Created: ${liga.ligaId}`);
          },
          async (rejected) => {
            if (rejected && rejected.code === 11000) {
              console.log(`Updated: ${liga.ligaId}`);
              await Liga.findOne({
                ligaId: liga.ligaId,
              }).updateOne(liga);
            }
          }
        );
      }
    }

    if (response.hasMoreData) {
      await updateLigen(parseInt(index) + parseInt(response.size));
    }
  } catch (error) {
    console.log(error);
  }
};

/**
 * This function updates the matches data.
 * @returns {Promise} - A Promise that resolves when the matches data is updated.
 */
module.exports.updateMatches = async function updateMatches() {
  const ligen = await Liga.find({});
  const requests = ligen.map((liga) => updateMatch(liga));
  return await Promise.all(requests);
};

/**
 * This function updates the match data for a specific league.
 * @param {object} liga - The league data.
 * @returns {Promise} - A Promise that resolves when the match data for the league is updated.
 */
async function updateMatch(liga) {
  // Warten bis SDK geladen ist
  if (!BasketballBundSDK) {
    const { BasketballBundSDK: SDK } = await import("basketball-bund-sdk");
    BasketballBundSDK = SDK;
  }
  
  const sdk = new BasketballBundSDK();
  const data = await sdk.competition.getSpielplan({
    competitionId: liga.ligaId,
  });
  if (!data) {
    console.log(`No data returned for liga ${liga.ligaId}`);
    return;
  }

  try {
    const matches = data.matches;
    if (!matches) {
      console.log(`No matches found for liga ${liga.ligaId}`);
      return;
    }

    const promise = matches.map((match, index) =>
      matchRef(match, index, matches.length, liga)
    );
    await Promise.all(promise);
    return await liga.save();
  } catch (error) {
    console.log(error);
  }
}

/**
 * This function updates the referee data for a specific match.
 * @param {object} _m - The match data.
 * @param {number} index - The index of the match.
 * @param {number} max - The total number of matches.
 * @param {object} liga - The league data.
 * @returns {Promise} - A Promise that resolves when the referee data for the match is updated.
 */
async function matchRef(_m, index, max, liga) {
  // Warten bis SDK geladen ist
  if (!BasketballBundSDK) {
    const { BasketballBundSDK: SDK } = await import("basketball-bund-sdk");
    BasketballBundSDK = SDK;
  }
  
  const sdk = new BasketballBundSDK();
  const matchInfo = await sdk.match.getMatchInfo({
    matchId: _m.matchId,
  });
  var sr1 = null;
  var sr2 = null;
  if (matchInfo.matchInfo.srList) {
    if (matchInfo.matchInfo.srList[0]) {
      if (matchInfo.matchInfo.srList[0].personData) {
        if (
          matchInfo.matchInfo.srList[0].personData.vorname.toLowerCase() ===
          "verein"
        ) {
          sr1 = matchInfo.matchInfo.srList[0].personData.nachname;
        } else {
          sr1 = "Pool";
        }
      }
    }
    if (matchInfo.matchInfo.srList[1]) {
      if (matchInfo.matchInfo.srList[1].personData) {
        if (
          matchInfo.matchInfo.srList[1].personData.vorname.toLowerCase() ===
          "verein"
        ) {
          sr2 = matchInfo.matchInfo.srList[1].personData.nachname;
        } else {
          sr2 = "Pool";
        }
      }
    }
  }
  if (!matchInfo.homeTeam || !matchInfo.guestTeam) {
    console.log("SKIPPED: KEIN TEAM => " + matchInfo.matchId);
    return;
  }

  var match = {
    matchId: matchInfo.matchId,
    matchDay: matchInfo.matchDay,
    matchNo: matchInfo.matchNo,
    kickoffDate: matchInfo.kickoffDate,
    kickoffTime: matchInfo.kickoffTime,
    verzicht: matchInfo.verzicht,
    abgesagt: matchInfo.abgesagt,
    liganame: matchInfo.ligaData.liganame,
    homeTeam: matchInfo.homeTeam.teamname,
    guestTeam: matchInfo.guestTeam.teamname,
    spielfeld: matchInfo.matchInfo.spielfeld.bezeichnung,
    sr1: sr1,
    sr1Basar: false,
    sr1Besetzt: false,
    sr1Bonus: null,
    sr1Info: null,
    sr1Name: null,
    sr2: sr2,
    sr2Basar: false,
    sr2Besetzt: false,
    sr2Bonus: null,
    sr2Info: null,
  };
  const m = new Match(match);

  const matchRef = await m.save().then(
    (success) => {
      console.log(`${liga.ligaId}: CREATE ${index} / ${max}`);
      return success._id;
    },
    async (rejected) => {
      if (rejected && rejected.code === 11000) {
        const result = await Match.findOne({
          matchId: match.matchId,
        });
        if (result.homeTeam !== match.homeTeam) {
          await Match.findOneAndUpdate(
            {
              matchId: match.matchId,
            },
            {
              homeTeam: matchInfo.homeTeam.teamname,
            }
          );
        }
        if (result.guestTeam !== match.guestTeam) {
          await Match.findOneAndUpdate(
            {
              matchId: match.matchId,
            },
            {
              guestTeam: matchInfo.guestTeam.teamname,
            }
          );
        }
        if (
          result.kickoffDate !== match.kickoffDate ||
          result.kickoffTime !== match.kickoffTime ||
          result.verzicht !== match.verzicht ||
          result.abgesagt !== match.abgesagt
        ) {
          if (result.sr1Basar || result.sr1Besetzt) {
            const user = await User.find({ club: result.sr1 });
            const date = new Date(result.kickoffDate);
            const newDate = new Date(match.kickoffDate);
            await mail(
              result.sr1Mail
                ? [...user.map((_u) => _u.email), result.sr1Mail]
                : user.map((_u) => _u.email),
              "[SPIELEBASAR] Info Veränderung Spielplan",
              getEmailText(
                "",
                "du erhälst diese Mail, da es eine Veränderung im Spielplan gab und dieses Spiel im Basar oder als besetzt markiert hast. Die Ansetzung entfällt!",
                false,
                `<strong>Spiel (alt):</strong><br/>${result.liganame}  ${
                  result.matchNo
                }<br/>${date.getDate()}.${
                  date.getMonth() + 1
                }.${date.getFullYear()} ${result.kickoffTime}<br/>${
                  result.spielfeld
                }<br/>
                                            ${result.homeTeam} - ${
                  result.guestTeam
                }<br/>${result.sr1} ${
                  result.sr2
                }<br/><br/><strong>Spiel (neu):</strong><br/>${newDate.getDate()}.${
                  newDate.getMonth() + 1
                }.${newDate.getFullYear()} ${match.kickoffTime}<br/>
                                            ${match.spielfeld}<br/>${
                  match.homeTeam
                } - ${match.guestTeam}<br/>${match.sr1} ${match.sr2}<br/><br/>
                                            <strong>Folgende Infos hattest du hinterlegt:</strong><br/>Bonus: ${
                                              result.sr1Bonus
                                            }<br/>${
                  result.sr1Name ? result.sr1Name : "[*Keine Name hinterlegt*]"
                }<br/>${
                  result.sr1Info
                    ? result.sr1Info
                    : "[*Keine Informationen hinterlegt*]"
                }`
              )
            );
          }
          if (result.sr2Basar || result.sr2Besetzt) {
            const user = await User.find({ club: result.sr2 });
            const date = new Date(result.kickoffDate);
            const newDate = new Date(match.kickoffDate);
            await mail(
              result.sr2Mail
                ? [...user.map((_u) => _u.email), result.sr2Mail]
                : user.map((_u) => _u.email),
              "[SPIELEBASAR] Info Veränderung Spielplan",
              getEmailText(
                "",
                "du erhälst diese Mail, da es eine Veränderung im Spielplan gab und dieses Spiel im Basar oder als besetzt markiert hast. Die Ansetzung entfällt!",
                false,
                `<strong>Spiel (alt):</strong><br/>${result.liganame}  ${
                  result.matchNo
                }<br/>${date.getDate()}.${
                  date.getMonth() + 1
                }.${date.getFullYear()} ${result.kickoffTime}<br/>${
                  result.spielfeld
                }<br/>
                                            ${result.homeTeam} - ${
                  result.guestTeam
                }<br/>${result.sr1} ${
                  result.sr2
                }<br/><br/><strong>Spiel (neu):</strong><br/>${newDate.getDate()}.${
                  newDate.getMonth() + 1
                }.${newDate.getFullYear()} ${match.kickoffTime}<br/>
                                            ${match.spielfeld}<br/>${
                  match.homeTeam
                } - ${match.guestTeam}<br/>${match.sr1} ${match.sr2}<br/><br/>
                                            <strong>Folgende Infos hattest du hinterlegt:</strong><br/>Bonus: ${
                                              result.sr2Bonus
                                            }<br/>${
                  result.sr2Name ? result.sr2Name : "[*Keine Name hinterlegt*]"
                }<br/>${
                  result.sr2Info
                    ? result.sr2Info
                    : "[*Keine Informationen hinterlegt*]"
                }`
              )
            );
          }
          await result.updateOne(match);
          console.log(`${liga.ligaId}: UPDATED ${index} / ${max}`);
        } else {
          if (result.sr1 !== match.sr1 || result.sr2 !== match.sr2) {
            if (result.sr2 !== match.sr2) {
              if (result.sr2Basar || result.sr2Besetzt) {
                const user = await User.find({ club: result.sr2 });
                const date = new Date(result.kickoffDate);
                const newDate = new Date(match.kickoffDate);
                await mail(
                  result.sr2Mail
                    ? [...user.map((_u) => _u.email), result.sr2Mail]
                    : user.map((_u) => _u.email),
                  "[SPIELEBASAR] Info Veränderung Spielplan",
                  getEmailText(
                    "",
                    "du erhälst diese Mail, da es eine Veränderung im Spielplan gab und dieses Spiel im Basar oder als besetzt markiert hast. Die Ansetzung entfällt!",
                    false,
                    `<strong>Spiel (alt):</strong><br/>${result.liganame}  ${
                      result.matchNo
                    }<br/>${date.getDate()}.${
                      date.getMonth() + 1
                    }.${date.getFullYear()} ${result.kickoffTime}<br/>${
                      result.spielfeld
                    }<br/>
                                            ${result.homeTeam} - ${
                      result.guestTeam
                    }<br/>${result.sr1} ${
                      result.sr2
                    }<br/><br/><strong>Spiel (neu):</strong><br/>${newDate.getDate()}.${
                      newDate.getMonth() + 1
                    }.${newDate.getFullYear()} ${match.kickoffTime}<br/>
                                            ${match.spielfeld}<br/>${
                      match.homeTeam
                    } - ${match.guestTeam}<br/>${match.sr1} ${
                      match.sr2
                    }<br/><br/>
                                            <strong>Folgende Infos hattest du hinterlegt:</strong><br/>Bonus: ${
                                              result.sr2Bonus
                                            }<br/>${
                      result.sr2Name
                        ? result.sr2Name
                        : "[*Keine Name hinterlegt*]"
                    }<br/>${
                      result.sr2Info
                        ? result.sr2Info
                        : "[*Keine Informationen hinterlegt*]"
                    }`
                  )
                );
              }
              await result.updateOne({
                sr2: sr2,
                sr2Basar: false,
                sr2Besetzt: false,
                sr2Mail: null,
                sr2Bonus: null,
                sr2Info: null,
                sr2Name: null,
              });
            }
            if (result.sr1 !== match.sr1) {
              if (result.sr1Basar || result.sr1Besetzt) {
                const user = await User.find({ club: result.sr1 });
                const date = new Date(result.kickoffDate);
                const newDate = new Date(match.kickoffDate);
                await mail(
                  result.sr1Mail
                    ? [...user.map((_u) => _u.email), result.sr1Mail]
                    : user.map((_u) => _u.email),
                  "[SPIELEBASAR] Info Veränderung Spielplan",
                  getEmailText(
                    "",
                    "du erhälst diese Mail, da es eine Veränderung im Spielplan gab und dieses Spiel im Basar oder als besetzt markiert hast. Die Ansetzung entfällt!",
                    false,
                    `<strong>Spiel (alt):</strong><br/>${result.liganame}  ${
                      result.matchNo
                    }<br/>${date.getDate()}.${
                      date.getMonth() + 1
                    }.${date.getFullYear()} ${result.kickoffTime}<br/>${
                      result.spielfeld
                    }<br/>
                                            ${result.homeTeam} - ${
                      result.guestTeam
                    }<br/>${result.sr1} ${
                      result.sr2
                    }<br/><br/><strong>Spiel (neu):</strong><br/>${newDate.getDate()}.${
                      newDate.getMonth() + 1
                    }.${newDate.getFullYear()} ${match.kickoffTime}<br/>
                                            ${match.spielfeld}<br/>${
                      match.homeTeam
                    } - ${match.guestTeam}<br/>${match.sr1} ${
                      match.sr2
                    }<br/><br/>
                                            <strong>Folgende Infos hattest du hinterlegt:</strong><br/>Bonus: ${
                                              result.sr1Bonus
                                            }<br/>${
                      result.sr1Name
                        ? result.sr1Name
                        : "[*Keine Name hinterlegt*]"
                    }<br/>${
                      result.sr1Info
                        ? result.sr1Info
                        : "[*Keine Informationen hinterlegt*]"
                    }`
                  )
                );
              }
              await result.updateOne({
                sr1: sr1,
                sr1Basar: false,
                sr1Besetzt: false,
                sr1Mail: null,
                sr1Bonus: null,
                sr1Info: null,
                sr1Name: null,
              });
            }

            console.log(`${liga.ligaId}: REF ${index} / ${max}`);
          }
          if (result.spielfeld !== match.spielfeld) {
            if (result.sr1Basar || result.sr1Besetzt) {
              const user = await User.find({ club: result.sr1 });
              const date = new Date(result.kickoffDate);
              const newDate = new Date(match.kickoffDate);
              await mail(
                user.map((_u) => _u.email),
                "[SPIELEBASAR] Info Veränderung Spielplan",
                getEmailText(
                  "",
                  "du erhälst diese Mail, da es eine Veränderung im Spielplan gab und dieses Spiel im Basar oder als besetzt markiert hast. Die Ansetzung bleibt bestehen!",
                  false,
                  `<strong>Spiel (alt):</strong><br/>${result.liganame}  ${
                    result.matchNo
                  }<br/>${date.getDate()}.${
                    date.getMonth() + 1
                  }.${date.getFullYear()} ${result.kickoffTime}<br/>${
                    result.spielfeld
                  }<br/>
                                            ${result.homeTeam} - ${
                    result.guestTeam
                  }<br/>${result.sr1} ${
                    result.sr2
                  }<br/><br/><strong>Spiel (neu):</strong><br/>${newDate.getDate()}.${
                    newDate.getMonth() + 1
                  }.${newDate.getFullYear()} ${match.kickoffTime}<br/>
                                            ${match.spielfeld}<br/>${
                    match.homeTeam
                  } - ${match.guestTeam}<br/>${match.sr1} ${match.sr2}<br/><br/>
                                            <strong>Folgende Infos hattest du hinterlegt:</strong><br/>Bonus: ${
                                              result.sr1Bonus
                                            }<br/>${
                    result.sr1Name
                      ? result.sr1Name
                      : "[*Keine Name hinterlegt*]"
                  }<br/>${
                    result.sr1Info
                      ? result.sr1Info
                      : "[*Keine Informationen hinterlegt*]"
                  }`
                )
              );
            }
            if (result.sr2Basar || result.sr2Besetzt) {
              const user = await User.find({ club: result.sr2 });
              const date = new Date(result.kickoffDate);
              const newDate = new Date(match.kickoffDate);
              await mail(
                user.map((_u) => _u.email),
                "[SPIELEBASAR] Info Veränderung Spielplan",
                getEmailText(
                  "",
                  "du erhälst diese Mail, da es eine Veränderung im Spielplan gab und dieses Spiel im Basar oder als besetzt markiert hast. Die Ansetzung bleibt bestehen!",
                  false,
                  `<strong>Spiel (alt):</strong><br/>${result.liganame}  ${
                    result.matchNo
                  }<br/>${date.getDate()}.${
                    date.getMonth() + 1
                  }.${date.getFullYear()} ${result.kickoffTime}<br/>${
                    result.spielfeld
                  }<br/>
                                            ${result.homeTeam} - ${
                    result.guestTeam
                  }<br/>${result.sr1} ${
                    result.sr2
                  }<br/><br/><strong>Spiel (neu):</strong><br/>${newDate.getDate()}.${
                    newDate.getMonth() + 1
                  }.${newDate.getFullYear()} ${match.kickoffTime}<br/>
                                            ${match.spielfeld}<br/>${
                    match.homeTeam
                  } - ${match.guestTeam}<br/>${match.sr1} ${match.sr2}<br/><br/>
                                            <strong>Folgende Infos hattest du hinterlegt:</strong><br/>Bonus: ${
                                              result.sr2Bonus
                                            }<br/>${
                    result.sr2Name
                      ? result.sr2Name
                      : "[*Keine Name hinterlegt*]"
                  }<br/>${
                    result.sr2Info
                      ? result.sr2Info
                      : "[*Keine Informationen hinterlegt*]"
                  }`
                )
              );
            }
            await result.updateOne({
              spielfeld: match.spielfeld,
            });
            console.log(`${liga.ligaId}: LOKATION ${index} / ${max}`);
          } else {
            console.log(`${liga.ligaId}: SKIPPED ${index} / ${max}`);
          }
        }
        return result._id;
      }
    }
  );

  if (liga.matches.indexOf(matchRef) === -1) {
    liga.matches.push(matchRef);
  }
}
