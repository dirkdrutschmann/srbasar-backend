const {Link, User, Answer, Match} = require("../_models"); // Importing Link, User, Answer, Match models
const Crypto = require("crypto"); // Importing Crypto for generating random UUIDs
const {mail, getEmailText} = require("../_mailer/mailer"); // Importing mail and getEmailText from mailer
const mongoose = require("mongoose"); // Importing mongoose for MongoDB database

/**
 * This function lists all the links for a user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.list = async (req, res) => {
    const user = await User.findById(req.userId)
    if (user) {
        var links = []
        const link = await Link.find({user: user._id})
        for (_link of link) {
            if(!_link.onlyShow){
                const answer = await Answer.find({link: _link._id})
                links.push({..._link.toObject(), answer: answer})
            }else{
                links.push({..._link.toObject()})
            }
        }
        return res.json(links)
    }
    res.json([])
}

/**
 * This function adds a link for a user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.add = async (req, res) => {
    const user = await User.findById(req.userId)
    var alias = Crypto.randomUUID()
    if (user) {
        if (req.body.alias !== null) {
            const already = await Link.findOne({link: req.body.alias})
            if (already !== null) {
                return res.status(409).json({message: "Alias-Link ist bereits in Verwendung bitte einen anderen wählen"})
            }
            alias = req.body.alias
        }
        if(req.body.verein === "ALLE")
        {
            req.body.verein = user.club
        }else{
            req.body.verein = [req.body.verein]
        }
        const link = await Link.create({
            user: user,
            start: req.body.start,
            end: req.body.end,
            verein: JSON.stringify(req.body.verein),
            lizenzstufe: req.body.lizenzstufe,
            link: alias,
            onlyShow: req.body.onlyShow
        })
        res.json({message: "Link wurde angelegt."})
    }
}

/**
 * This function removes a link for a user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.remove = async (req, res) => {
    try{
        const user = await User.findById(req.userId)
        if (user && req.params.link !== undefined) {
            const link = await Link.findById(req.params.link).populate('user')
            if(link.user._id.equals(user._id)){
                const answer = await Answer.find({link: req.params.link})
                for (_answer of answer) {
                    _answer.remove()
                }
                link.remove()
            }
        }
        res.json({message: "Link wurde gelöscht"})
    }catch(error){
        res.json({message: "Link nicht gefunden!"})
    }

}

/**
 * This function removes an answer for a user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.removeAnswer = async (req, res) => {
    const user = await User.findById(req.userId)
    if (user && req.params.answer !== undefined) {
        const answer = await Answer.findByIdAndRemove(req.params.answer)
    }
    res.json({message: "Link wurde gelöscht"})
}

/**
 * This function gets an answer for a link.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.getAnswer = async (req, res) =>{
    const link = req.params.answer
    if (link) {
        const user = await User.findById(req.userId)
        const linkObject = await Link.findOne({link: link})
        if(linkObject.user.equals(user._id)) {

            const answers = await Answer.find({link: linkObject._id}).populate('games')
            return res.status(200).json({answers: answers})
        }

    }

    return res.status(400).json({message: "Link wurde nicht gefunden"})
}

/**
 * This function gets a link.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.get = async (req, res) => {
    const link = req.params.link

    if (link) {
        const linkObject = await Link.findOne({link: link})
        if (linkObject) {

            const gt = linkObject.start ? linkObject.start : `${(new Date()).getFullYear()}-${("0" + ((new Date()).getMonth() + 1)).slice(-2)}-${("0"+(new Date()).getDate()).slice(-2)}`
            const and = [{kickoffDate: {$gte: gt}}];
            if( linkObject.end){
                and.push({kickoffDate: {$lte: linkObject.end}})
            }
            var matches = await Match.find({
                $and: [...and,
                    {$or: [{sr1: {$in: JSON.parse(linkObject.verein)}}, {sr2: {$in: JSON.parse(linkObject.verein)}}]}
                ]
            })
            matches = matches.map(match => {
                return {...match.toObject(), lizenzstufe: lizenzstufe(match)}
            })
            if(linkObject.lizenzstufe === "LSE+ | LSD"){
                matches = matches.filter(match => match.lizenzstufe === "LSE+ | LSD" || match.lizenzstufe === "LSE")
            }else if(linkObject.lizenzstufe === "LSE"){
                matches = matches.filter(match => match.lizenzstufe === "LSE")
            }
            return res.status(200).json({club: linkObject.verein, matches: matches, onlyShow: linkObject.onlyShow, link: linkObject})
        }
    }
    return res.status(400).json({message: "Link wurde nicht gefunden"})
}

/**
 * This function determines the license level based on the data.
 * @param {object} data - The data object.
 */
function lizenzstufe(data) {
    if (data.liganame.includes("Herren")) {
        if (data.liganame.includes("Kreisliga")) {
            return "LSE"
        }
        return "LSD"
    }
    if (data.liganame.includes("Damen")) {
        if (data.liganame.includes("Bezirksliga")) {
            return "LSE"
        }
        if (data.liganame.includes("Landesliga")) {
            return "LSE"
        }
        return "LSD"
    }
    if(data.liganame.includes("Oberliga")){
        return "LSE+ | LSD"
    }
    if(data.liganame.includes("Playoffs")){
        return "LSE+ | LSD"
    }
    return "LSE"
}

/**
 * This function creates an answer for a link.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.answer = async (req, res) => {
    const link = await Link.findById(req.body.link)
    await Answer.create({
        link: link._id,
        name: req.body.name,
        email: req.body.email,
        telefon: req.body.telefon,
        lizenzstufe: req.body.lizenzstufe,
        message: req.body.message,
        games: req.body.games
    })
    const user = await User.findById(link.user)

    if(req.body.sendMail){
        await mail(req.body.email, `[LINK ANTWORT] Antwort übermittelt`,
            getEmailText(
                "",
                `deine Antwort wurde übertragen, du hast insgesamt ${req.body.games.length} Spiele angegeben, die du übernehmen möchtest.<br/><br/>${req.body.games.map(game => convertToGermanDate(game.kickoffDate) +" " + game.kickoffTime + " " + game.spielfeld + " " + game.liganame).join("<br>")}${req.body.message ?  '<br/><br/>Zusätzliche Mitteilung:<br/>'+req.body.message : ""}`,
                false,
                "Bitte beachte, dass du mit dieser Auswahl lediglich den Wunsch äußerst die Spiele zu übernehmen, dies <strong><u>ist keine</u></strong> verbindliche Zusage des Vereines!",
                null,
                null)
        )
    }


    await mail(user.email, `[LINK ANTWORT] Neue Antwort von ${req.body.name}`,
        getEmailText(
            "",
            `es gibt eine Antwort von ${req.body.name},<br/>insgesamt können ${req.body.games.length} Spiele übernommen werden.<br/><br/>
                        ${req.body.games.map(game => convertToGermanDate(game.kickoffDate) +" " + game.kickoffTime + " " + game.spielfeld + " " + game.liganame).join("<br>")}}${req.body.message ?  '<br/><br/>Zusätzliche Mitteilung:<br/>'+req.body.message : ""}`,
            true,
            "Log dich ein um die Antwort zu sehen und die Spiele zu bearbeiten",
            "",
            ""),
        req.body.email)


    return res.status(200).json({message: "Antwort gespeichert"})
}

/**
 * This function converts an English date string to a German date string.
 * @param {string} englishDateString - The English date string.
 */
const convertToGermanDate = (englishDateString) => {
    // Aufteilen des Eingabe-Strings in Jahr, Monat und Tag
    const [year, month, day] = englishDateString.split('-');

    // Erstellen eines Date-Objekts
    const date = new Date(year, month - 1, day); // Monate sind in JavaScript 0-basiert

    // Überprüfen, ob das Date-Objekt gültig ist
    if (isNaN(date.getTime())) {
        return "Ungültiges Datum";
    }

    // Erstellen eines deutschen Datums-Strings
    const germanDateString = date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    return germanDateString;
}