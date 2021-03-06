import React, { useState } from "react";

const AuthContext = React.createContext({
  //we will declare and initialize them in the later part, so the code here only for readability and intelSense, no technical effect
  //notice everything you get from localStorage will be string, since we rely on localStorage, here everything will be string to let intelSense remind user these thing will be string when we access them.
  id: "",
  email: "",
  name: "",
  token: "",
  role: "",
  verified_at: null,
  isLoggedIn: false,
  login: (token, id, email, name, role, verified_at) => {},
  logout: () => {},
});

export const AuthContextProvider = (props) => {
  const storedToken = localStorage.getItem("token");
  const storedId = localStorage.getItem("id");
  const storedEmail = localStorage.getItem("email");
  const storedName = localStorage.getItem("name");
  const storedRole = localStorage.getItem("role");
  let storedVerified_at = localStorage.getItem("verified_at");
  if (storedVerified_at === "null") {
    storedVerified_at = null;
  }
  const [token, setToken] = useState(storedToken);
  const [id, setId] = useState(storedId);
  const [email, setEmail] = useState(storedEmail);
  const [name, setName] = useState(storedName);
  const [role, setRole] = useState(storedRole);
  const [verified_at, setVerified_at] = useState(storedVerified_at);
  const userIsLoggedIn = !!token; //The first ! is just for converting to boolean

  const loginHandler = (token, id, email, name, role, verified_at) => {
    //store to localStorage so that user doesn't need to login next time
    //localStorage.setIten("token") must be earlier than setToken(), since the initial fetch of the home page will use get(), and get() depends on localStorage.set.
    localStorage.setItem("token", token);
    localStorage.setItem("id", id);
    localStorage.setItem("email", email);
    localStorage.setItem("name", name);
    localStorage.setItem("role", role);
    localStorage.setItem("verified_at", verified_at);
    setToken(token); //will trigger userIsLoggedIn to true and then trigger react router to redirect
    setId(id);
    setEmail(email);
    setName(name);
    setRole(role);
    setVerified_at(verified_at);
  };

  const logoutHandler = () => {
    setToken(null);
    setId(null);
    setEmail(null);
    setName(null);
    setRole(null);
    setVerified_at(null);
    localStorage.removeItem("token");
    localStorage.removeItem("id");
    localStorage.removeItem("email");
    localStorage.removeItem("name");
    localStorage.removeItem("role");
    localStorage.removeItem("verified_at");
  };

  //provide an interface for components to use i.e. authCtx.xxx
  const contextValue = {
    id: id,
    email: email,
    token: token,
    name: name,
    role: role,
    verified_at: verified_at,
    isLoggedIn: userIsLoggedIn,
    login: loginHandler,
    logout: logoutHandler,
  };

  return <AuthContext.Provider value={contextValue}>{props.children}</AuthContext.Provider>;
};

export default AuthContext;
