const { mail, getEmailText} = require("../_mailer/mailer"); // Importing mail and getEmailText from mailer
const {Match, User} = require("../_models"); // Importing Match and User models

/**
 * This function lists all the matches for a club.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.list = async (req, res) => {
    const ref = await Match.find({$or: [{sr1: req.club},{sr2: req.club}]})

    res.json(ref)
}

/**
 * This function lists all the matches.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.all = async (req, res) => {
    const ref = await Match.find().select("-sr2Bonus -sr2Name -sr1Name -sr1Bonus -sr1Info -sr2Info")
    res.json(ref.filter((game) => {
        return (Math.floor(new Date() / 1000) - Math.floor(new Date(game.kickoffDate) / 1000)) < 86400 && !game.abgesagt && !game.verzicht  && game.sr1 !== null && game.sr2 !== null
      }))
}

/**
 * This function takes over a game.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.uebernehmen = async (req, res) => {
    const game = await Match.findOne({matchId: parseInt(req.params.game)})
    if(!game){
        res.status(404)
        return res.send({error: "Game doesn't exist!"})
    }
    const user = await User.find({club: req.body.sr})
    if(!user){
        res.status(200)
        return res.send({error: "No User found"})
    }
    const date = new Date(game.kickoffDate)
     await mail(user.map((user) => user.email), "[SPIELEBASAR] Übernahme " + game.liganame + game.matchNo,
         getEmailText("", `es gibt eine Übernahmeanfrage von ${req.body.name} <br/><br/><strong>Spiel:</strong><br/>${game.liganame}  ${game.matchNo}<br/>${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${game.kickoffTime} ${game.spielfeld}<br/>${game.homeTeam} - ${game.guestTeam}<br/><br/><strong>Schiedsrichter:</strong><br/><strong>Name :</strong> ${req.body.name}${req.body.email ? `<br/><strong>E-Mail:</strong> ` + req.body.email : ""}${req.body.mobile ? `<br/><strong>Handy:</strong> ` + req.body.mobile : ""}<br/><strong>Lizenz:</strong> ${req.body.lizenz}<br/><br/>${req.body.message ? `<strong>Nachricht:</strong><br/><br/>${req.body.message}<br/>` : ""}`, !!req.body.mobile,
             ``, `${process.env.WHATSAPP_API_URL}/${req.body.mobile}?text=${encodeURI(`Hallo ${req.body.name}, vielen Dank für deine Anfrage,  hiermit habe ich dich für das Spiel *${game.liganame}${game.matchNo}* am *${new Date(game.kickoffDate).getDate()}.${new Date(game.kickoffDate).getMonth() + 1}.${new Date(game.kickoffDate).getFullYear()}* um *${game.kickoffTime}* *${game.spielfeld}* für *${req.body.sr}* angesetzt. Liebe Grüße`)}`, "Per Whatsapp antworten"),
         req.body.email ? req.body.email : false)

}

/**
 * This function lists all the matches for a basar.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.basar = async (req, res) => {
    console.log("BASAR")
    const ref = await Match.find({abgesagt:false, verzicht:false, $or: [{sr1Basar:true, sr1Besetzt: false}, {sr2Basar:true, sr2Besetzt: false}]})
    const user = await User.find({$or: [{showContact: true}, {getEmails: true}]})

    var games = ref.filter((game) => {
        return (Math.floor(new Date() / 1000) - Math.floor(new Date(game.kickoffDate) / 1000)) < 86400
      })

    var spiele = []
      for (const game of games){
        var newValue = {...game.toObject()}
        delete newValue.sr1Info
        delete newValue.sr2Info
        if(game.sr1Basar){
            const sr1User = user.filter((user) => user.club.includes(game.sr1))
            newValue.sr1Contact = sr1User.map((user)=> {
                    return {
                        getEmails: user.getEmails,
                        name: user.name,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        contactInfo: user.contactInfo,
                        showInfo: user.showInfo,
                        showMail: user.showMail,
                        showContact: user.showContact,
                        email: user.email,
                        phone: user.phone,
                        whatsapp: user.whatsapp
                    }
            })
        }
        if(game.sr2Basar){
            const sr2User = user.filter((user) => user.club.includes(game.sr2))

            newValue.sr2Contact = sr2User.map((user)=> {

                    return {
                        getEmails: user.getEmails,
                        name: user.name,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        contactInfo: user.contactInfo,
                        showInfo: user.showInfo,
                        showMail: user.showMail,
                        showContact: user.showContact,
                        email: user.email,
                        phone: user.phone,
                        whatsapp: user.whatsapp
                    }
            })
        }
      spiele.push(newValue)
      }

    res.json(spiele)
}

/**
 * This function lists all the clubs.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.vereine = async (req, res) => {
    try {
        const ref = await Match.find({}).select({sr1: 1, sr2: 1})
        var refList =[]
        for (const _r of ref){
            var index = refList.findIndex(_ref => _ref === _r.sr1);
            if (index === -1 && _r.sr1 !== null) {
                refList.push(_r.sr1);
            }
            index = refList.findIndex(_ref => _ref === _r.sr2);
            if (index === -1 && _r.sr2 !== null) {
                refList.push(_r.sr2);
            }
        }
        res.json(refList)
    } catch {
        res.status(404).send({error: "Ref doesn't exist!" })
    }
}
