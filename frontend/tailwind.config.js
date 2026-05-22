/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        genviz: {
          primary: '#417FA2',
          orange: '#fe5b04',
          dark: '#1e293b',
          darker: '#0f172a',
          card: '#1e293b',
          accent: '#417FA2',
          accentHover: '#336688',
          title: '#343430',
          loginTop: '#3a5568',
          loginBottom: '#a87040',
          loginBtn: '#e87030',
          loginBtnHover: '#d06020',
        }
      }
    },
  },
  plugins: [],
}
