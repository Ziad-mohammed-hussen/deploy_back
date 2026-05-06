const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // ممكن يكون سجل قبل كده بالإيميل العادي
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // ربط الحساب الموجود بجوجل
            user.googleId = profile.id;
            user.isVerified = true;
            await user.save();
          } else {
            // عمل حساب جديد
            user = await User.create({
              googleId: profile.id,
              firstName: profile.name.givenName, // جوجل بيدينا الاسم الأول منفصل
              lastName: profile.name.familyName, // والاسم الأخير منفصل
              email: profile.emails[0].value,
              isVerified: true,
            });
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;