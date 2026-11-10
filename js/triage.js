/* ============================================================
   Sarp Pitara — Clinical triage & ASV protocol evaluator
   Decision support only. Always follow institutional protocol.
   ============================================================ */
(function (global) {
  "use strict";
  const SP = (global.SP = global.SP || {});

  const SYMPTOM_GROUPS = [
    {
      key: "local",
      title: "Local",
      hindi: "स्थानीय लक्षण",
      symptoms: ["Local Swelling", "Local Pain", "Blister Formation", "Bleeding From Bite Site"]
    },
    {
      key: "neuro",
      title: "Neurotoxic",
      hindi: "न्यूरोटॉक्सिक",
      symptoms: ["Ptosis (Drooping Eyelids)", "Difficulty Breathing", "Difficulty Speaking", "Difficulty Swallowing", "Abdominal Pain", "Muscle Weakness"]
    },
    {
      key: "hemo",
      title: "Hemotoxic",
      hindi: "हीमोटॉक्सिक",
      symptoms: ["Spontaneous Bleeding", "Gum Bleeding", "Blood in Urine", "Internal Bleeding", "Persistent Oozing"]
    },
    {
      key: "systemic",
      title: "Systemic / Other",
      hindi: "अन्य",
      symptoms: ["Nausea / Vomiting", "Altered Sensorium", "Low Blood Pressure", "Tachycardia", "Anuria (No Urine)"]
    }
  ];

  const NEURO = ["Ptosis (Drooping Eyelids)", "Difficulty Breathing", "Difficulty Speaking", "Difficulty Swallowing", "Muscle Weakness"];
  const HEMO = ["Spontaneous Bleeding", "Gum Bleeding", "Blood in Urine", "Internal Bleeding", "Persistent Oozing"];
  const SEVERE = ["Difficulty Breathing", "Difficulty Swallowing", "Spontaneous Bleeding", "Internal Bleeding", "Altered Sensorium", "Anuria (No Urine)"];

  function evaluate(input) {
    const i = input || {};
    const symptoms = i.symptoms || [];
    const venom = i.suspected_venom_class || "Indeterminate";
    const wbct = i.twentym_wbct_positive;
    const sbp = Number(i.initial_systolic_bp);
    const spo2 = Number(i.initial_spo2_percent);
    const rr = Number(i.respiratory_rate);
    const hr = Number(i.initial_heart_rate);

    const hasNeuro = symptoms.some((s) => NEURO.indexOf(s) !== -1);
    const hasHemo = symptoms.some((s) => HEMO.indexOf(s) !== -1);
    const hasSevere = symptoms.some((s) => SEVERE.indexOf(s) !== -1);
    const vitalsCritical = (sbp && sbp < 90) || (spo2 && spo2 < 94) || (rr && rr > 30) || (hr && hr > 130);
    const localOnly = symptoms.length > 0 && !hasNeuro && !hasHemo && !hasSevere && !vitalsCritical;
    const nonVenom = venom === "NonVenomous";

    let severity = "Asymptomatic";
    if (hasSevere || vitalsCritical || (wbct === true && hasHemo)) severity = "Severe";
    else if (hasNeuro || hasHemo || wbct === true || localOnly) severity = "Moderate";
    else if (symptoms.length > 0) severity = "Mild";

    if (nonVenom && !hasSevere && !vitalsCritical) {
      severity = symptoms.length ? "Mild" : "Asymptomatic";
    }

    let vials = 0;
    const actions = [];
    let repeatWBCT = null;
    let title = "";
    let detail = "";
    let color = "green";

    if (nonVenom) {
      color = "green";
      title = "No ASV indicated";
      detail = "Non-venomous or dry bite pattern. Clean wound, reassure, observe. Reassess if systemic signs appear.";
      actions.push("Wash wound with clean water; do not cut or suck.");
      actions.push("Observe for 24 hours; repeat 20WBCT only if symptoms develop.");
      actions.push("Tetanus prophylaxis as per protocol.");
    } else if (severity === "Asymptomatic") {
      color = "green";
      title = "Observe — ASV not yet indicated";
      detail = "No systemic envenomation signs. Start a 24-hour dry-bite observation clock with 2-hourly vitals and ptosis checks.";
      actions.push("Admit for observation or strict follow-up.");
      actions.push("Check ptosis, single-breath count and bleeding every 2 hours.");
      actions.push("Perform 20WBCT on arrival and at 6 hours if hemotoxic species suspected.");
      repeatWBCT = 6;
    } else if (severity === "Mild") {
      color = "amber";
      title = "Local reaction — reassess";
      detail = "Local signs only. Immobilise the limb, mark swelling margins, and reassess within 1–2 hours. ASV only if progression or systemic signs.";
      actions.push("Immobilise limb with splint / crepe bandage (not tight).");
      actions.push("Mark the swelling border and time every 30 minutes.");
      actions.push("Perform 20WBCT if viper bite suspected.");
      actions.push("Reassess for ptosis and bleeding in 1–2 hours.");
      repeatWBCT = 6;
    } else {
      color = severity === "Severe" ? "red" : "amber";
      vials = 10;
      title = "ASV indicated — 10 vials initial bolus";
      detail = "Give 10 vials polyvalent ASV in 200 ml normal saline IV over 60 minutes. Same dose for children. Monitor for anaphylaxis.";
      actions.push("Secure IV access and start ASV infusion over 60 minutes.");
      actions.push("Keep adrenaline (1:1000) 0.5 ml IM ready for anaphylaxis.");
      actions.push("Monitor vitals every 15 minutes during infusion.");
      if (hasHemo || wbct === true) {
        repeatWBCT = 6;
        actions.push("Repeat 20WBCT at 6 hours; watch urine colour and output.");
      }
      if (hasNeuro || venom === "Neurotoxic") {
        repeatWBCT = repeatWBCT || 2;
        actions.push("Reassess neuro signs in 1–2 hours; if no improvement, repeat 10 vials.");
        actions.push("Consider neostigmine test for cobra bite (atropine 0.6 mg + neostigmine 1.5 mg IV).");
      }
      if (severity === "Severe") {
        actions.push("Shift to ICU / ventilator support; monitor respiratory capacity.");
        actions.push("Repeat 20WBCT and ASV as per response; watch for AKI.");
      }
      if (Number(i.age_years) > 0 && Number(i.age_years) <= 12) {
        actions.push("Paediatric note: venom volume is not reduced — give the full 10-vial dose.");
      }
    }

    return {
      severity,
      color,
      title,
      detail,
      recommendedVials: vials,
      repeatWBCTHours: repeatWBCT,
      hasNeuro,
      hasHemo,
      vitalsCritical,
      actions,
      flags: {
        neuro: hasNeuro,
        hemo: hasHemo,
        wbctPositive: wbct === true,
        criticalVitals: vitalsCritical
      }
    };
  }

  function severityBadge(sev) {
    const map = {
      Asymptomatic: "green",
      Mild: "cyan",
      Moderate: "amber",
      Severe: "red",
      Fatal: "solid-red"
    };
    return map[sev] || "cyan";
  }

  function venomBadge(venom) {
    if (venom === "Neurotoxic") return "amber";
    if (venom === "Hemotoxic") return "red";
    if (venom === "NonVenomous") return "green";
    return "violet";
  }

  SP.Triage = { SYMPTOM_GROUPS, evaluate, severityBadge, venomBadge };
})(window);
