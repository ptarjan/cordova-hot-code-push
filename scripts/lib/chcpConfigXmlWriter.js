/**
Helper module to work with config.xml file.
We will use it to inject plugin-specific options.
*/
(function() {

  var fs = require('fs'),
    path = require('path'),
    xml2js = require('xml2js'),
    cordovaContext,
    projectRoot,
    platforms;

  module.exports = {
    writeOptions: writeOptions
  };

  // region Public API

  /**
   * Inject options into config.xml files of each platform.
   *
   * @param {Object} context - cordova context instance
   * @param {Object} options - plugin options to inject
   */
  function writeOptions(context, options) {
    setup(context);
    injectOptions(options);
  }

  // endregion

  // region Private API
  /**
   * Initialize module.
   *
   * @param {Object} cordovaContext - cordova context instance
   */
  function setup(context) {
    cordovaContext = context;
    platforms = context.opts.platforms;
    projectRoot = context.opts.projectRoot;
  }

  /**
   * Get name of the current project.
   *
   * @param {Object} ctx - cordova context instance
   * @param {String} projectRoot - current root of the project
   *
   * @return {String} name of the project
   */
  function getProjectName(ctx, projectRoot) {
    var cordova_util = ctx.requireCordovaModule('cordova-lib/src/cordova/util'),
      ConfigParser = ctx.requireCordovaModule('cordova-lib/src/configparser/ConfigParser'),
      xml = cordova_util.projectConfig(projectRoot),
      cfg = new ConfigParser(xml);

    return cfg.name();
  }

  /**
   * Get path to config.xml inside iOS project.
   *
   * @return {String} absolute path to config.xml file
   */
  function pathToIosConfigXml() {
    var projectName = getProjectName(cordovaContext, projectRoot);

    return path.join(projectRoot, 'platforms', 'ios', projectName, 'config.xml');
  }

  /**
   * Get path to config.xml inside Android project.
   *
   * @return {String} absolute path to config.xml file
   */
  function pathToAndroidConfigXml() {
    return path.join(projectRoot, 'platforms', 'android', 'res', 'xml', 'config.xml');
  }

  /**
   * Get path to platform-specific config.xml file.
   *
   * @param {String} platform - for what platform we need config.xml
   * @return {String} absolute path to config.xml
   */
  function getPlatformSpecificConfigXml(platform) {
    var configFilePath = null;
    switch (platform) {
      case 'ios':
        {
          configFilePath = pathToIosConfigXml();
          break;
        }
      case 'android':
        {
          configFilePath = pathToAndroidConfigXml();
          break;
        }
    }

    return configFilePath;
  }

  /**
   * Write provided options into config.xml file for each platform.
   *
   * @param {Object} options - plugin options
   */
  function injectOptions(options) {
    platforms.forEach(function(platform) {
      var configXmlFilePath = getPlatformSpecificConfigXml(platform);
      if (configXmlFilePath == null) {
        return;
      }

      // read data from config.xml
      var configData = readConfigXml(configXmlFilePath);
      if (configData == null) {
        console.warn('Configuration file ' + configXmlFilePath + ' not found');
        return;
      }

      // if config.xml already has chcp preferences - read them
      var chcpConfig = {};
      if (configData.widget.hasOwnProperty('chcp') && configData.widget.chcp.lenght > 0) {
        chcpConfig = configData.widget.chcp[0];
      } else {
        configData.widget['chcp'] = [];
      }

      // inject new options
      injectConfigUrl(chcpConfig, options);
      injectLocalDevOptions(chcpConfig, options);

      // write them back to config.xml
      configData.widget.chcp[0] = chcpConfig;
      writeConfigXml(configXmlFilePath, configData);
    });
  }

  /**
   * Inject config-file preference if any is set in provided options.
   *
   * @param {Object} xml - config.xml data
   * @param {Object} options - plugin options to inject
   */
  function injectConfigUrl(xml, options) {
    if (!options.hasOwnProperty('config-file')) {
      return;
    }

    xml['config-file'] = [{
      '$': {
        'url': options['config-file']
      }
    }];
  }

  /**
   * Inject local-development options if any is set in provided options.
   *
   * @param {Object} xml - config.xml data
   * @param {Object} options - plugin options to inject
   */
  function injectLocalDevOptions(xml, options) {
    if (!options.hasOwnProperty('local-development')) {
      return;
    }

    var localDevBlock = {};
    localDevBlock['$'] = {
      enabled: options['local-development'].enabled
    };

    xml['local-development'] = [localDevBlock];
  }

  /**
   * Write xml data into the given file.
   *
   * @param {String} filePath - path to the file where to write provided data
   * @param {Object} xmlData - xml data to write
   */
  function writeConfigXml(filePath, xmlData) {
    var xmlBuilder = new xml2js.Builder();
    var changedXmlData = xmlBuilder.buildObject(xmlData);
    fs.writeFileSync(filePath, changedXmlData);
  }

  /**
   * Read xml data from the specified file.
   *
   * @param {String} filePath - path to the xml file
   * @return {Object} xml data from the file
   */
  function readConfigXml(filePath) {
    var xmlData = null;
    var parsedData = null;

    try {
      xmlData = fs.readFileSync(filePath);
      var xmlParser = new xml2js.Parser();
      xmlParser.parseString(xmlData, function(err, data) {
        if (data) {
          parsedData = data;
        }
      });
    } catch (err) {
      console.log(err);
    }

    return parsedData;
  };

  // endregion

})();
