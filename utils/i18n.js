const translations = {
  en: {
    inquiry_success: "Your message has been sent successfully. We will get back to you soon!",
    fields_required: "Please provide all required fields.",
    not_found: "Resource not found",
    server_error: "Internal Server Error"
  },
  ar: {
    inquiry_success: "تم إرسال رسالتك بنجاح. سنتواصل معك قريباً!",
    fields_required: "يرجى ملء جميع الحقول المطلوبة.",
    not_found: "المورد غير موجود",
    server_error: "خطأ داخلي في الخادم"
  }
};

const t = (key, lang = 'en') => {
  return translations[lang]?.[key] || translations['en'][key] || key;
};

module.exports = t;
