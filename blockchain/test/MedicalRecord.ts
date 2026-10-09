import { expect } from "chai";
import { ethers } from "ethers";
import { network } from "hardhat";

describe("MedicalRecord", function () {

  async function deployContract() {
    const { ethers } = await network.connect();

    const MedicalRecord =
      await ethers.getContractFactory("MedicalRecord");

    const medicalRecord =
      await MedicalRecord.deploy();

    await medicalRecord.waitForDeployment();

    return medicalRecord;
  }

  it("devrait enregistrer un hash", async function () {

    const contract = await deployContract();

    const patientId = "PATIENT001";

    const hash = ethers.keccak256(
      ethers.toUtf8Bytes("dossier medical v1")
    );

    await contract.storeHash(patientId, hash);

    expect(
      await contract.getLatestHash(patientId)
    ).to.equal(hash);
  });

  it("devrait récupérer le dernier hash", async function () {

    const contract = await deployContract();

    const patientId = "PATIENT001";

    const hash1 = ethers.keccak256(
      ethers.toUtf8Bytes("version 1")
    );

    const hash2 = ethers.keccak256(
      ethers.toUtf8Bytes("version 2")
    );

    await contract.storeHash(patientId, hash1);
    await contract.storeHash(patientId, hash2);

    expect(
      await contract.getLatestHash(patientId)
    ).to.equal(hash2);
  });

  it("devrait vérifier un hash correct", async function () {

    const contract = await deployContract();

    const patientId = "PATIENT001";

    const hash = ethers.keccak256(
      ethers.toUtf8Bytes("dossier medical")
    );

    await contract.storeHash(patientId, hash);

    expect(
      await contract.verifyHash(patientId, hash)
    ).to.equal(true);
  });

  it("devrait détecter un hash incorrect", async function () {

    const contract = await deployContract();

    const patientId = "PATIENT001";

    const correctHash = ethers.keccak256(
      ethers.toUtf8Bytes("dossier original")
    );

    const incorrectHash = ethers.keccak256(
      ethers.toUtf8Bytes("dossier modifie")
    );

    await contract.storeHash(patientId, correctHash);

    expect(
      await contract.verifyHash(patientId, incorrectHash)
    ).to.equal(false);
  });

  it("devrait retourner false pour un patient sans dossier", async function () {

    const contract = await deployContract();

    const hash = ethers.keccak256(
      ethers.toUtf8Bytes("test")
    );

    expect(
      await contract.verifyHash("PATIENT_INCONNU", hash)
    ).to.equal(false);

    expect(
      await contract.getVersionCount("PATIENT_INCONNU")
    ).to.equal(0);
  });

  it("devrait gérer plusieurs versions", async function () {

    const contract = await deployContract();

    const patientId = "PATIENT001";

    const hash1 = ethers.keccak256(
      ethers.toUtf8Bytes("version 1")
    );

    const hash2 = ethers.keccak256(
      ethers.toUtf8Bytes("version 2")
    );

    const hash3 = ethers.keccak256(
      ethers.toUtf8Bytes("version 3")
    );

    await contract.storeHash(patientId, hash1);
    await contract.storeHash(patientId, hash2);
    await contract.storeHash(patientId, hash3);

    expect(
      await contract.getVersionCount(patientId)
    ).to.equal(3);

    expect(
      await contract.getLatestHash(patientId)
    ).to.equal(hash3);
  });

  it("devrait émettre l'événement RecordHashStored", async function () {

    const contract = await deployContract();

    const patientId = "PATIENT001";

    const hash = ethers.keccak256(
      ethers.toUtf8Bytes("dossier medical")
    );

    await expect(
      contract.storeHash(patientId, hash)
    ).to.emit(contract, "RecordHashStored");
  });

});