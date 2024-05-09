const axios = require('axios');
const CryptoJS = require('crypto-js');

const io = require('socket.io')(3001, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }
})

io.on('connection', socket => {
    socket.on('get-document', async documentId => {
        const document = await findOrCreateDocument(documentId);
        socket.join(documentId)

        socket.emit('load-document', document)

        socket.on('send-changes', delta => {
            socket.broadcast.to(documentId).emit('receive-changes', delta)
        });

        socket.on('save-document', async data => {
            const dataToString = JSON.stringify(data.content);

            var repetition = Math.ceil(32 / data.password.length);
            var password = data.password.repeat(repetition).slice(0, 32);
            var ownerTo16 = data.owner.slice(0,16);

            var key = CryptoJS.enc.Utf8.parse(password);
            var iv = CryptoJS.enc.Utf8.parse(ownerTo16);

            var plainTextToArray = CryptoJS.enc.Utf8.parse(dataToString);
            var encrypt = CryptoJS.AES.encrypt(plainTextToArray, key, { iv: iv });

            var cipher = encrypt.toString();

            await findAndUpdateDocument(documentId, cipher, data.title, data.user_id);
        });
    })
})

async function findOrCreateDocument(id){
    if(id == null) return;

    try{
        const response = await axios.get(`http://127.0.0.1:8000/api/documents/get-document-details/${id}`); 

        if(response.data.data == null || response.data.data.length == 0) {
            return null;
        }

        const cipher = response.data.data;

        var pwkey = CryptoJS.enc.Utf8.parse('keysuntukenkripsipasswordskripsi');
        var pwiv = CryptoJS.enc.Utf8.parse('keyskeduaskripsi');
        
        var passwordValue = CryptoJS.AES.decrypt(cipher.password, pwkey, { iv: pwiv })
            .toString(CryptoJS.enc.Utf8);

        var repetition = Math.ceil(32 / passwordValue.length);
        var password = passwordValue.repeat(repetition).slice(0, 32);
        var ownerTo16 = cipher.owner.slice(0,16);

        var key = CryptoJS.enc.Utf8.parse(password);
        var iv = CryptoJS.enc.Utf8.parse(ownerTo16);
        var plainText = CryptoJS.AES.decrypt(cipher.content, key, { iv: iv });
        var document = plainText.toString(CryptoJS.enc.Utf8);

        var documentDetail = {
            "title" : cipher.title,
            "content" : document,
            "owner" : cipher.owner,
            "password" : passwordValue
        };

        if(documentDetail) {
            return documentDetail
        };

        return `{"ops":[]}`;
    } catch (error) {
        console.error("Error finding or creating document:", error);
    }
}

async function findAndUpdateDocument(id, data, title, user_id){
    if(id == null) return;

    const param = `{
        "title" : "${title}",
        "content" : "${data}",
        "user_id" : "${user_id}"
    }`;

    try {
        const response = await axios.patch(`http://127.0.0.1:8000/api/documents/${id}`, JSON.parse(param));
    } catch (error) {
        console.error("Error updating document:", error);
    }
} 