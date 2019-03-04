"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _require = require("path"),
    basename = _require.basename,
    relative = _require.relative;

var not = require("logical-not");

var ImportType = {
  DEFAULT: 1,
  MEMBER: 2,
  ANONYMOUS: 3
};

function _default(_ref) {
  var t = _ref.types;
  return {
    visitor: {
      Identifier: function Identifier(path, _ref2) {
        var options = _ref2.opts,
            file = _ref2.file;
        if (relative(file.opts.root, file.opts.filename).match(/^node_modules/)) return;
        if (not(isCorrectIdentifier(path))) return;
        var identifier = path.node,
            scope = path.scope;
        if (isDefined(identifier, scope)) return;
        var declarations = options.declarations;
        if (not(Array.isArray(declarations))) return;
        var filename = basename(file.opts.filename);
        declarations.some(handleDeclaration, {
          path: path,
          identifier: identifier,
          filename: filename
        });
      }
    }
  };

  function isCorrectIdentifier(path) {
    var parentPath = path.parentPath;
    if (parentPath.isArrayExpression()) return true;else if (parentPath.isArrowFunctionExpression()) return true;else if (parentPath.isAssignmentExpression() && parentPath.get("right") == path) return true;else if (parentPath.isAwaitExpression()) return true;else if (parentPath.isBinaryExpression()) return true;else if (parentPath.bindExpression && parentPath.bindExpression()) return true;else if (parentPath.isCallExpression()) return true;else if (parentPath.isClassDeclaration() && parentPath.get("superClass") == path) return true;else if (parentPath.isClassExpression() && parentPath.get("superClass") == path) return true;else if (parentPath.isConditionalExpression()) return true;else if (parentPath.isDecorator()) return true;else if (parentPath.isDoWhileStatement()) return true;else if (parentPath.isExpressionStatement()) return true;else if (parentPath.isExportDefaultDeclaration()) return true;else if (parentPath.isForInStatement()) return true;else if (parentPath.isForStatement()) return true;else if (parentPath.isIfStatement()) return true;else if (parentPath.isLogicalExpression()) return true;else if (parentPath.isMemberExpression() && parentPath.get("object") == path) return true;else if (parentPath.isNewExpression()) return true;else if (parentPath.isObjectProperty() && parentPath.get("value") == path) return not(parentPath.node.shorthand);else if (parentPath.isReturnStatement()) return true;else if (parentPath.isSpreadElement()) return true;else if (parentPath.isSwitchStatement()) return true;else if (parentPath.isTaggedTemplateExpression()) return true;else if (parentPath.isThrowStatement()) return true;else if (parentPath.isUnaryExpression()) return true;else if (parentPath.isVariableDeclarator() && parentPath.get("init") == path) return true;else return false;
  }

  function isDefined(identifier, _ref3) {
    var bindings = _ref3.bindings,
        parent = _ref3.parent;
    var variables = Object.keys(bindings);
    if (variables.some(has, identifier)) return true;
    return parent ? isDefined(identifier, parent) : false;
  }

  function has(identifier) {
    var name = this.name;
    return identifier == name;
  }

  function handleDeclaration(declaration) {
    var path = this.path,
        identifier = this.identifier,
        filename = this.filename;
    if (not(declaration)) return;
    var importType = null;

    if (hasDefault(declaration, identifier)) {
      importType = ImportType.DEFAULT;
    } else if (hasMember(declaration, identifier)) {
      importType = ImportType.MEMBER;
    } else if (hasAnonymous(declaration, identifier)) {
      importType = ImportType.ANONYMOUS;
    }

    if (importType) {
      var program = path.findParent(isProgram);
      var pathToModule = getPathToModule(declaration, filename);
      insertImport(program, identifier, importType, pathToModule);
      return true;
    }
  }

  function hasDefault(declaration, identifier) {
    return declaration["default"] == identifier.name;
  }

  function hasMember(declaration, identifier) {
    var members = Array.isArray(declaration.members) ? declaration.members : [];
    return members.some(has, identifier);
  }

  function hasAnonymous(declaration, identifier) {
    var anonymous = Array.isArray(declaration.anonymous) ? declaration.anonymous : [];
    return anonymous.some(has, identifier);
  }

  function insertImport(program, identifier, type, pathToModule) {
    var programBody = program.get("body");
    var currentImportDeclarations = programBody.reduce(toImportDeclarations, []);
    var importDidAppend;
    importDidAppend = currentImportDeclarations.some(importAlreadyExists, {
      identifier: identifier,
      type: type,
      pathToModule: pathToModule
    });
    if (importDidAppend) return;
    importDidAppend = currentImportDeclarations.some(addToImportDeclaration, {
      identifier: identifier,
      type: type,
      pathToModule: pathToModule
    });
    if (importDidAppend) return;
    var specifiers = [];

    if (type == ImportType.DEFAULT) {
      specifiers.push(t.importDefaultSpecifier(identifier));
    } else if (type == ImportType.MEMBER) {
      specifiers.push(t.importSpecifier(identifier, identifier));
    } else if (type == ImportType.ANONYMOUS) {}

    var importDeclaration = t.importDeclaration(specifiers, t.stringLiteral(pathToModule));
    program.unshiftContainer("body", importDeclaration);
  }

  function isProgram(path) {
    return path.isProgram();
  }

  function toImportDeclarations(list, currentPath) {
    if (currentPath.isImportDeclaration()) list.push(currentPath);
    return list;
  }

  function importAlreadyExists(_ref4) {
    var importDeclaration = _ref4.node;
    var identifier = this.identifier,
        type = this.type,
        pathToModule = this.pathToModule;

    if (importDeclaration.source.value == pathToModule) {
      if (type == ImportType.ANONYMOUS) return true;
      return importDeclaration.specifiers.some(checkSpecifierLocalName, identifier);
    }
  }

  function checkSpecifierLocalName(specifier) {
    var identifier = this;
    return specifier.local.name == identifier.name;
  }

  function addToImportDeclaration(importDeclarationPath) {
    var identifier = this.identifier,
        type = this.type,
        pathToModule = this.pathToModule;
    var node = importDeclarationPath.node;
    if (node.source.value != pathToModule) return false;
    var specifiers = node.specifiers;

    if (type == ImportType.DEFAULT) {
      if (not(specifiers.some(hasImportDefaultSpecifier))) {
        var specifier = t.importDefaultSpecifier(identifier);
        importDeclarationPath.unshiftContainer("specifiers", specifier);
        return true;
      }
    }

    if (type == ImportType.MEMBER) {
      if (not(specifiers.some(hasSpecifierWithName, identifier))) {
        var _specifier = t.importSpecifier(identifier, identifier);

        importDeclarationPath.pushContainer("specifiers", _specifier);
        return true;
      }
    }
  }

  function hasImportDefaultSpecifier(node) {
    return t.isImportDefaultSpecifier(node);
  }

  function hasSpecifierWithName(node) {
    if (not(t.isImportSpecifier(node))) return false;
    var name = this.name;
    return node.imported.name == name;
  }

  function getPathToModule(declaration, filename) {
    if (declaration.path.includes("[name]")) {
      var pattern = declaration.nameReplacePattern || "\.js$";
      var newSubString = declaration.nameReplaceString || "";
      var name = filename.replace(new RegExp(pattern), newSubString);
      return declaration.path.replace("[name]", name);
    }

    return declaration.path;
  }
}