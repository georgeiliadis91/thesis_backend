const crypto = require("crypto");
const _ = require("lodash");

const permissionModel = {
  private: "private",
  public: "public",
  authed: "authenticated",
};

module.exports = (plugin) => {
  // Add the custom route
  plugin.routes["content-api"].routes.unshift({
    method: "PUT",
    path: "/users/me",
    handler: "user.updateMe",
    config: {
      prefix: "",
    },
  });
  //
  plugin.routes["content-api"].routes.unshift({
    method: "GET",
    path: "/users/countries",
    handler: "user.countries",
    config: {
      prefix: "",
    },
  });

  const userCreate = plugin.controllers.auth.register;

  //filter out fields we do not want to expose on the front end
  const sanitizeOutput = (user) => {
    const {
      password,
      resetPasswordToken,
      confirmationToken,
      username,
      ...sanitizedUser
    } = user; // be careful, you need to omit other private attributes yourself
    return sanitizedUser;
  };

  //filter out fields we do not want to expose on the front end
  const sanitizeUserWithPermissions = (ctx, userData) => {
    const { permissions } = userData.profile_data;

    let isAuthenticated = false;

    if (ctx.state.user) {
      isAuthenticated = true;
    }

    const newUser = {};

    Object.keys(permissions).forEach((key) => {
      const fieldKey = permissions[key];

      if (
        (fieldKey === "authenticated" && isAuthenticated) ||
        fieldKey === "public"
      ) {
        newUser[key] = userData[key];
      }

      if (fieldKey === "private") {
        return;
      }
      // if is profile_data object
      if (key === "profile_data") {
        const profileData = {};
        Object.keys(permissions.profile_data).forEach((key) => {
          const keyPermission = permissions.profile_data[key];

          if (
            (keyPermission === "authenticated" && isAuthenticated) ||
            keyPermission === "public"
          ) {
            profileData[key] = userData.profile_data[key];
          }

          if (keyPermission === "private") {
            return;
          }
        });

        if (Object.keys(profileData).length > 0) {
          newUser["profile_data"] = profileData;
        }
      }
    });

    //  if no keys found
    if (Object.keys(newUser).length === 0) {
      return null;
    }

    return { id: userData.id, ...newUser };
  };

  // Get self
  plugin.controllers.user.me = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      ctx.state.user.id,
      { populate: ["profile_data"] }
    );

    ctx.body = sanitizeOutput(user);
  };

  // Get all users
  plugin.controllers.user.find = async (ctx) => {
    const users = await strapi.entityService.findMany(
      "plugin::users-permissions.user",
      { ...ctx.params, populate: ["profile_data"] }
    );

    const tmpUser = users
      // filter out self
      .filter((user) => {
        if (ctx?.state?.user?.id) {
          return user.id !== ctx.state.user.id;
        }
        return true;
      })
      .map((user) => {
        return sanitizeUserWithPermissions(ctx, user);
      });

    ctx.body = tmpUser.filter((user) => user !== null);
  };

  // Get one user
  plugin.controllers.user.findOne = async (ctx) => {
    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      ctx.params.id,
      { ...ctx.params, populate: ["profile_data"] }
    );

    ctx.body = sanitizeUserWithPermissions(ctx, user);
  };

  plugin.controllers.auth.register = async (ctx) => {
    const { private } = permissionModel;

    ctx.request.body.email = ctx.request.body.email;
    ctx.request.body.password = ctx.request.body.password;

    ctx.request.body.profile_data = {
      name: ctx.request.body.profile_data.name,
      surname: ctx.request.body.profile_data.surname,
      current_country: ctx.request.body.profile_data.current_country,
      island: ctx.request.body.profile_data.island,
      dimotiki_enotita: ctx.request.body.profile_data.dimotiki_enotita,
      permissions: {
        email: private,
        username: private,
        profile_data: {
          name: private,
          island: private,
          surname: private,
          birthdate: private,
          occupation: private,
          birth_place: private,
          father_name: private,
          mother_name: private,
          postal_code: private,
          current_city: private,
          other_groups: private,
          phone_number: private,
          current_street: private,
          father_surname: private,
          mother_surname: private,
          current_country: private,
          dimotiki_enotita: private,
        },
      },
    };

    ctx.request.body.confirmed = true;

    await userCreate(ctx);
  };

  const getController = (name) => {
    return strapi.plugins["users-permissions"].controller(name);
  };

  // Create the new controller
  plugin.controllers.user.updateMe = async (ctx) => {
    const user = ctx.state.user;

    // User has to be logged in to update themselves
    if (!user) {
      return ctx.unauthorized();
    }

    // Pick only specific fields for security
    const newData = _.pick(ctx.request.body, [
      "email",
      "username",
      "password",
      "confirmPassword",
      "profile_data",
    ]);

    // Make sure there is no duplicate user with the same username
    if (newData.username) {
      const userWithSameUsername = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { username: newData.username } });

      if (userWithSameUsername && userWithSameUsername.id != user.id) {
        return ctx.badRequest("Username already taken");
      }
    }

    // Make sure there is no duplicate user with the same email
    if (newData.email) {
      const userWithSameEmail = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email: newData.email.toLowerCase() } });

      if (userWithSameEmail && userWithSameEmail.id != user.id) {
        return ctx.badRequest("Email already taken");
      }
      newData.email = newData.email.toLowerCase();
    }

    // Check if user is changing password and make sure passwords match
    if (newData.password) {
      if (!newData.confirmPassword) {
        return ctx.badRequest("Missing password confirmation");
      } else if (newData.password !== newData.confirmPassword) {
        return ctx.badRequest("Passwords don't match");
      }
      delete newData.confirmPassword;
    }

    // Reconstruct context so we can pass to the controller
    ctx.request.body = newData;
    ctx.params = { id: user.id };

    // Update the user and return the sanitized data
    return await getController("user").update(ctx);
  };

  plugin.controllers.user.countries = async (ctx) => {
    const users = await strapi.entityService.findMany(
      "plugin::users-permissions.user",
      { ...ctx.params, populate: ["profile_data"] }
    );

    console.log("users", users);
    const countryList = {};
    // extract unique country names and increament the count
    users.forEach((user) => {
      if (
        user.profile_data.current_country !== undefined &&
        user.profile_data.current_country !== null
      ) {
        if (
          Object.keys(countryList).includes(user.profile_data.current_country)
        ) {
          countryList[user.profile_data.current_country] += 1;
        } else {
          countryList[user.profile_data.current_country] = 1;
        }
      }
    });
    ctx.body = countryList;
  };

  return plugin;
};
