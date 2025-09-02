    // ===== Supabase (optional, keep for future use) =====
    const SUPABASE_URL = "https://wdjntnboatkzuwyoikkr.supabase.co";
    const SUPABASE_KEY = "sb_publishable_7LcvdE3Q2NlnmJM_wb3qHA_ucbjPkKV";
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ===== State =====
    let lastSentData = null;
    let otpModalInstance = null;

    // ===== LIFF Init =====
    async function main() {
      try {
        await liff.init({ liffId: "2007772610-2rjPV8NG" });
      } catch (e) {
        console.error("LIFF init failed", e);
      }

      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }

      try {
        const profile = await liff.getProfile();
        document.getElementById("userId").value = profile.userId;
        document.getElementById("displayName").value = profile.displayName;
      } catch (e) {
        console.error("Get profile failed", e);
      }
    }

    document.addEventListener("DOMContentLoaded", () => {
      const otpModalEl = document.getElementById("otpModal");
      otpModalInstance = new bootstrap.Modal(otpModalEl, { backdrop: 'static', keyboard: false });

      document.getElementById("verifyOtpBtn").addEventListener("click", verifyOtp);
      document.getElementById("resendOtpBtn").addEventListener("click", resendOtp);

      // UX: enter to verify OTP
      document.getElementById('inputOtp').addEventListener('keydown', (ev)=>{
        if (ev.key === 'Enter') verifyOtp();
      });
    });

    // ===== Form Submit =====
    document.getElementById("form").addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById('submitBtn');
      const spinner = document.getElementById('submitSpinner');

      const phone = document.getElementById("phone").value.trim();
      if (!/^\d{10}$/.test(phone)) {
        Swal.fire("เบอร์ไม่ถูกต้อง", "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก", "warning");
        return;
      }

      const data = {
        userId: document.getElementById("userId").value,
        name: document.getElementById("flname").value,
        nickname: document.getElementById("nname").value,
        dob: document.getElementById("dob").value,
        position: document.getElementById("position").value,
        email: document.getElementById("email").value,
        phone: phone
      };

      lastSentData = data;

      try {
        submitBtn.disabled = true; spinner.classList.remove('d-none');

        const res = await fetch("https://n8n-three.nn-dev.me/webhook/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

        const result = await res.json();

        if (!result.success) {
          Swal.fire("ไม่สามารถส่ง OTP ได้", result.message || "กรุณาลองใหม่อีกครั้ง", "error");
          return;
        }

        // แสดง modal ให้กรอก OTP
        document.getElementById("otp-phone").textContent = phone;
        document.getElementById("inputOtp").value = "";
        document.getElementById("otp-error").classList.add("d-none");
        otpModalInstance.show();

      } catch (e) {
        console.error(e);
        Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: e?.message ? e.message : String(e) });
      } finally {
        submitBtn.disabled = false; spinner.classList.add('d-none');
      }
    });

    // ===== OTP Verify =====
    async function verifyOtp() {
      const phone = document.getElementById("phone").value.trim();
      const userOtp = document.getElementById("inputOtp").value.trim();
      const errorEl = document.getElementById("otp-error");

      if (!/^\d{6}$/.test(userOtp)) {
        errorEl.textContent = "กรุณากรอกรหัส 6 หลัก";
        errorEl.classList.remove("d-none");
        return;
      }

      try {
        const verifyRes = await fetch("https://n8n-three.nn-dev.me/webhook/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, otp: userOtp })
        });

        const verifyResult = await verifyRes.json();

        if (!verifyResult.verified) {
          errorEl.textContent = "OTP ไม่ถูกต้องหรือหมดอายุ";
          errorEl.classList.remove("d-none");
          return;
        }

        // OTP ผ่านแล้ว — ไป insert แล้วแจ้งผลตามกรณี
        if (lastSentData) {
          const payload = { ...lastSentData, verified: true };
          try {
            const insertRes = await fetch("https://n8n-three.nn-dev.me/webhook/my-form", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const insertResult = await insertRes.json();

            // ปิด modal ก่อนแจ้งผล
            otpModalInstance.hide();

            if (insertResult.message === "duplicate") {
              Swal.fire({ icon: "info", title: "เคยลงทะเบียนแล้ว", text: "มีข้อมูลอยู่ในระบบแล้ว ไม่ต้องลงซ้ำ" })
                .then(() => { if (window.liff && liff.closeWindow) liff.closeWindow(); });
            } else if (insertResult.message === "success") {
              Swal.fire({ icon: "success", title: "ลงทะเบียนสำเร็จ", text: "ข้อมูลถูกบันทึกแล้ว" })
                .then(() => { if (window.liff && liff.closeWindow) liff.closeWindow(); });
            } else {
              Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
            }
          } catch (err) {
            console.error("Insert error:", err);
            otpModalInstance.hide();
            Swal.fire({ icon: "warning", title: "ลงทะเบียนไม่สมบูรณ์", text: "เกิดข้อผิดพลาดตอนบันทึกข้อมูล" });
          }
        } else {
          otpModalInstance.hide();
          Swal.fire({ icon: "error", title: "ไม่พบข้อมูล", text: "ข้อมูลการลงทะเบียนหายไป กรุณากรอกใหม่" });
        }

      } catch (err) {
        console.error(err);
        errorEl.textContent = "เกิดข้อผิดพลาดระหว่างตรวจสอบ OTP";
        errorEl.classList.remove("d-none");
      }
    }

    // ===== Resend OTP =====
    async function resendOtp() {
      if (!lastSentData) {
        Swal.fire("ไม่สามารถส่งใหม่ได้", "ข้อมูลเดิมไม่พบ กรุณากรอกฟอร์มใหม่", "warning");
        return;
      }

      try {
        const res = await fetch("https://n8n-three.nn-dev.me/webhook/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lastSentData)
        });

        const result = await res.json();

        if (!result.success) {
          Swal.fire("ส่ง OTP ใหม่ล้มเหลว", result.message || "ลองอีกครั้ง", "error");
          return;
        }

        Swal.fire({ icon: "success", title: "ส่งใหม่แล้ว", text: `รหัส OTP ถูกส่งไปที่ ${lastSentData.phone}` });

        document.getElementById("inputOtp").value = "";
        document.getElementById("otp-error").classList.add("d-none");

      } catch (e) {
        console.error(e);
        Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: e?.message ? e.message : String(e) });
      }
    }

    main();