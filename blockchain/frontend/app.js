let provider;
let signer;
let contract;

const CONTRACT_ADDRESS =
    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const CONTRACT_ABI = [
    "function storeHash(string patientId, bytes32 hash) public",
    "function getLatestHash(string patientId) public view returns (bytes32)",
    "function verifyHash(string patientId, bytes32 hash) public view returns (bool)",
    "function getVersionCount(string patientId) public view returns (uint256)"
];


// =====================================================
// 1. CONNECTER METAMASK
// =====================================================

document
    .getElementById("connectButton")
    .addEventListener("click", connectMetaMask);


async function connectMetaMask() {

    try {

        if (!window.ethereum) {

            alert("MetaMask n'est pas installé.");

            return;
        }


        // Demander l'accès au compte
        const accounts =
            await window.ethereum.request({
                method: "eth_requestAccounts"
            });


        // Provider Ethereum fourni par MetaMask
        provider =
            new ethers.BrowserProvider(window.ethereum);


        // Récupérer le compte
        signer =
            await provider.getSigner();


        const address =
            await signer.getAddress();


        // Afficher l'adresse
        document
            .getElementById("account")
            .textContent = address;


        // Identifier le réseau
        const network =
            await provider.getNetwork();


        document
            .getElementById("network")
            .textContent =
                `${network.name} - Chain ID ${network.chainId}`;


        // Connexion au smart contract
        contract =
            new ethers.Contract(
                CONTRACT_ADDRESS,
                CONTRACT_ABI,
                signer
            );


        document
            .getElementById("contractStatus")
            .textContent =
                "✅ Smart contract connecté";


        console.log("Compte :", address);
        console.log("Chain ID :", network.chainId);
        console.log("Contract :", CONTRACT_ADDRESS);

    }

    catch (error) {

        console.error(error);

        alert(
            "Erreur lors de la connexion à MetaMask."
        );
    }
}


// =====================================================
// 2. CALCULER LE HASH
// =====================================================

function calculateHash(data) {

    return ethers.keccak256(
        ethers.toUtf8Bytes(data)
    );
}


// =====================================================
// 3. ENREGISTRER LE HASH
// =====================================================

document
    .getElementById("storeButton")
    .addEventListener("click", storeHash);


async function storeHash() {

    try {

        if (!contract) {

            alert("Connectez d'abord MetaMask.");

            return;
        }


        const patientId =
            document
                .getElementById("patientId")
                .value;


        const data =
            document
                .getElementById("data")
                .value;


        if (!patientId || !data) {

            alert(
                "Veuillez remplir tous les champs."
            );

            return;
        }


        // Calcul du hash
        const hash =
            calculateHash(data);


        document
            .getElementById("storeResult")
            .textContent =
                "Transaction en cours...";


        // Appel du smart contract
        const tx =
            await contract.storeHash(
                patientId,
                hash
            );


        console.log(
            "Transaction :",
            tx.hash
        );


        // Attendre la confirmation
        await tx.wait();


        document
            .getElementById("storeResult")
            .innerHTML =
                `✅ Hash enregistré.<br>
                 Hash : <code>${hash}</code><br>
                 Transaction : <code>${tx.hash}</code>`;

    }

    catch (error) {

        console.error(error);

        document
            .getElementById("storeResult")
            .textContent =
                "❌ Erreur lors de l'enregistrement.";

    }
}


// =====================================================
// 4. LIRE LE DERNIER HASH
// =====================================================

document
    .getElementById("readButton")
    .addEventListener("click", readLatestHash);


async function readLatestHash() {

    try {

        if (!contract) {

            alert("Connectez d'abord MetaMask.");

            return;
        }


        const patientId =
            document
                .getElementById("readPatientId")
                .value;


        if (!patientId) {

            alert(
                "Veuillez saisir l'identifiant du patient."
            );

            return;
        }


        const hash =
            await contract.getLatestHash(
                patientId
            );


        document
            .getElementById("latestHash")
            .innerHTML =
                `Dernier hash : <code>${hash}</code>`;

    }

    catch (error) {

        console.error(error);

        document
            .getElementById("latestHash")
            .textContent =
                "❌ Aucun dossier trouvé ou erreur.";

    }
}


// =====================================================
// 5. VERIFIER L'INTEGRITE
// =====================================================

document
    .getElementById("verifyButton")
    .addEventListener("click", verifyIntegrity);


async function verifyIntegrity() {

    try {

        if (!contract) {

            alert("Connectez d'abord MetaMask.");

            return;
        }


        const patientId =
            document
                .getElementById("verifyPatientId")
                .value;


        const data =
            document
                .getElementById("verifyData")
                .value;


        if (!patientId || !data) {

            alert(
                "Veuillez remplir tous les champs."
            );

            return;
        }


        // Recalculer le hash
        const hash =
            calculateHash(data);


        // Vérification sur la blockchain
        const result =
            await contract.verifyHash(
                patientId,
                hash
            );


        if (result) {

            document
                .getElementById("verifyResult")
                .innerHTML =
                    "✅ Intégrité vérifiée : le dossier correspond au hash enregistré.";

        } else {

            document
                .getElementById("verifyResult")
                .innerHTML =
                    "❌ Intégrité non vérifiée : le dossier a été modifié.";

        }

    }

    catch (error) {

        console.error(error);

        document
            .getElementById("verifyResult")
            .textContent =
                "❌ Erreur lors de la vérification.";

    }
}