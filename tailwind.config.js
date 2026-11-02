const { couleurs, polices, tailles, rayons } = require("./src/theme/jetons");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: couleurs,
      fontFamily: polices,
      fontSize: tailles,
      borderRadius: rayons,
    },
  },
  plugins: [],
};
