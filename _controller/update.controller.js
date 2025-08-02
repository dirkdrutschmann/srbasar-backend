const {updateLigen, updateMatches} = require("../_teamsl/update"); // Importing updateLigen and updateMatches from update
const {Match} = require("../_models"); // Importing Match model

/**
 * This function updates the leagues.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.ligen = async (req, res) => {
    return await updateLigen()
        .then(() => {
            res.send('done') // Sending success response
        })
        .catch((error) => {
            console.log(error)
            res.status(404)
            res.send({error: 'An error occurred!'}) // Sending error response
        })
}

/**
 * This function updates the matches.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.matches = async (req, res) => {
    return await updateMatches()
        .then(() => {
            res.send('done') // Sending success response
        })
        .catch((error) => {
            console.log(error)
            res.status(404)
            res.send({error: 'An error occurred!'}) // Sending error response
        })
}

/**
 * This function updates a referee game.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.refgame = async (req, res) =>{

    const game = await Match.findOne({matchId: parseInt(req.params.game)}) // Finding the game
    if(!game){
        res.status(404)
        return res.send({error: "Game doesn't exist!"}) // Sending error response
    }
    console.log(req.body)
    if(req.body.sr1Basar !== undefined && req.club.includes(game.sr1)){
        await game.update({
            sr1Basar: req.body.sr1Basar,
            sr1Besetzt: req.body.sr1Besetzt,
            sr1Bonus: req.body.sr1Bonus,
            sr1Mail: req.body.sr1Mail,
            sr1Name: req.body.sr1Name,
            sr1Info: req.body.sr1Info
        })
        return res.json("ok") // Sending success response
    }
    if(req.body.sr2Basar !== undefined && req.club.includes(game.sr2))
    {
        await game.update({
            sr2Name: req.body.sr2Name,
            sr2Basar: req.body.sr2Basar,
            sr2Mail: req.body.sr2Mail,
            sr2Besetzt: req.body.sr2Besetzt,
            sr2Bonus: req.body.sr2Bonus,
            sr2Info: req.body.sr2Info
        })
        return  res.json("ok") // Sending success response
    }
   return  res.status(404).json("not found") // Sending error response
}

/**
 * This function updates all the leagues and matches.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.all = async (req, res) => {
    return await updateLigen(0)
        .then(
            async () => await updateMatches())
        .then(() => res.send('done')) // Sending success response
        .catch((error) => {
            console.log(error)
            res.status(404)
            res.send({error: 'An error occurred!'}) // Sending error response
        })
}