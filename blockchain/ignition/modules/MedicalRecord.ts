import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MedicalRecordModule = buildModule(
  "MedicalRecordModule",
  (m) => {
    const medicalRecord = m.contract("MedicalRecord");

    return {
      medicalRecord,
    };
  }
);

export default MedicalRecordModule;