module.exports = (plugin) => {
  const sanitizeOutput = (user) => {
    const {
      password,
      resetPasswordToken,
      confirmationToken,
      ...sanitizedUser
    } = user; // be careful, you need to omit other private attributes yourself
    return sanitizedUser;
  };

  const sanitizeUserWithPermissions = (ctx,userData) => {
  const {permissions} = userData.profile_data;

    let isAuthenticated = false;

    if(ctx.state.user){
      isAuthenticated = true;
    }

    // if me return empty object since its private to self
    if(permissions.everything ==='private'){
     return {}
    }

    // if all return all the fields
    if(permissions.everything ==='public'){
      return userData;
    }

    if(permissions.everything ==='custom'){

      const newUser = {};

      Object.keys(permissions).forEach((key) => {
        const fieldKey = permissions[key];

        // skip iteration for everything key
        if(key === 'everything'){
          return;
        }

        if(fieldKey ==='authed' || fieldKey ==='public' ){
          newUser[key]=userData[key];
        }
        // if is profile_data object
        if(key ==='profile_data'){
          const profileData = {};

          Object.keys(permissions.profile_data).forEach((key) => {

            const keyPermission = permissions.profile_data[key]

            if(keyPermission ==='authed' || keyPermission ==='all' ){
              profileData[key]=userData.profile_data[key];
            }

          })

          newUser['profile_data']=profileData;
        }
      });

      return {newUser};
    }

    return userData;
  }

  plugin.controllers.user.me = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      ctx.state.user.id,
      { populate: ["profile_data","profile_data.profile_img"] }
    );

    ctx.body = sanitizeOutput(user);
  };

  plugin.controllers.user.find = async (ctx) => {

    const users = await strapi.entityService.findMany(
      "plugin::users-permissions.user",
      { ...ctx.params, populate: ["profile_data","profile_data.profile_img"] }
    );
    //TODO : sanitize output according to user permission object

    ctx.body = users.map((user) => sanitizeOutput(user));
  };

  plugin.controllers.user.findOne = async (ctx) => {



    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      ctx.params.id,
      { ...ctx.params, populate: ["profile_data","profile_data.profile_img"] },
    );


    //TODO : sanitize output according to user permission object

    ctx.body = sanitizeOutput(sanitizeUserWithPermissions(ctx,user));

  };

  return plugin;
};
