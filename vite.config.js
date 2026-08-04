/*
  vite config, the only thing in here that matters is base

  base "./" makes the built site use relative paths, if you leave it as the
  default "/" the site works fine on vercel or netlify but it breaks on github
  pages cause github serves you from username.github.io/reponame/ and every
  asset would go looking at the root instead, took a while to figure that out
  so please dont delete this
*/

export default {
  base: '/CSARCH2-S03-G4-case-study-1/',
};
