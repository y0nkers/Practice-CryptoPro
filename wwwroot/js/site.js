var CADESCOM_CADES_BES = 1;
var CAPICOM_CURRENT_USER_STORE = 2;
var CAPICOM_MY_STORE = "My";
var CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2;
var CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME = 1;
var CADESCOM_BASE64_TO_BINARY = 1;
var CADESCOM_HASH_ALGORITHM = 100;

function run() {
    cadesplugin.async_spawn(function* (args) {
        // Проверяем, работает ли File API
        if (window.FileReader) {
            // Браузер поддерживает File API.
        } else {
            alert('The File APIs are not fully supported in this browser.');
        }
        if (0 === document.getElementById("uploadFile").files.length) {
            alert("Не выбран файл для подписи!");
            return;
        }
        var oFile = document.getElementById("uploadFile").files[0];
        var oFReader = new FileReader();

        if (typeof (oFReader.readAsDataURL) != "function") {
            alert("Method readAsDataURL() is not supported in FileReader.");
            return;
        }

        oFReader.readAsDataURL(oFile);

        oFReader.onload = function (oFREvent) {
            cadesplugin.async_spawn(function* (args) {
                var header = ";base64,";
                var sFileData = oFREvent.target.result;
                var sBase64Data = sFileData.substr(sFileData.indexOf(header) + header.length);

                // Создаем объект CAdESCOM.HashedData
                var oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");
                yield oHashedData.propset_Algorithm(CADESCOM_HASH_ALGORITHM);
                yield oHashedData.propset_DataEncoding(CADESCOM_BASE64_TO_BINARY);
                yield oHashedData.Hash(sBase64Data);
                var hashValue = yield oHashedData.Value;
                document.getElementById("hash").innerHTML = hashValue;

                var oCertName = document.getElementById("CertNameSelect");
               // console.dir(oCertName);

                var sCertName = oCertName[oCertName.selectedIndex].outerText; // Здесь следует заполнить SubjectName сертификата
                if ("" == sCertName) {
                    alert("Введите имя сертификата (CN).");
                    return;
                }
                var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
                yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE,
                    CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);

                var oStoreCerts = yield oStore.Certificates;
                var oCertificates = yield oStoreCerts.Find(
                    CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME, sCertName);
                var certsCount = yield oCertificates.Count;
                if (certsCount === 0) {
                    alert("Сертификат не найден: " + sCertName);
                    return;
                }
                var oCertificate = yield oCertificates.Item(1);
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                yield oSigner.propset_Certificate(oCertificate);
                yield oSigner.propset_CheckCertificate(true);

                var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                yield oSignedData.propset_ContentEncoding(CADESCOM_BASE64_TO_BINARY);
                yield oSignedData.propset_Content(sBase64Data);
                //yield oSignedData.propset_Content(hashValue);

                try {
                    var sSignedMessage = yield oSignedData.SignCades(oSigner, CADESCOM_CADES_BES, true);
                } catch (err) {
                    alert("Не удалось создать подпись. Ошибка: " + cadesplugin.getLastError(err));
                    return;
                }

                yield oStore.Close();

                // Выводим отделенную подпись в BASE64 на страницу
                // Такая подпись должна проверяться в КриптоАРМ и cryptcp.exe
                document.getElementById("signature").innerHTML = sSignedMessage;

                var oSignedData2 = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");

                try {
                    yield oSignedData2.propset_ContentEncoding(CADESCOM_BASE64_TO_BINARY);
                    yield oSignedData2.propset_Content(sBase64Data);
                    yield oSignedData2.VerifyCades(sSignedMessage, CADESCOM_CADES_BES, true);
                    alert("Подпись подтверждена.");
                } catch (err) {
                    alert("Не удалось подтвердить подпись. Ошибка: " + cadesplugin.getLastError(err));
                    return;
                }
            });
        };
    });
}

function downloadSignature() {
    if (document.getElementById("uploadFile").files.length === 0) {
        alert("Не выбран файл для подписи!");
        return;
    }

    let signature = document.getElementById("signature").innerHTML;
    if (signature == '') {
        alert("Поле с подписью пусто!");
        return;
    }

    let fileName, fileExtension;
    if (document.getElementById("uploadFile").files.length != 0) {
        let signedFile = document.getElementById("uploadFile").files[0];
        const file = signedFile.name;
        const lastDot = file.lastIndexOf('.');
        fileName = file.substring(0, lastDot);
        fileExtension = file.substring(lastDot + 1);
    }
    else {
        fileName = "example";
        fileExtension = "ext";
    }

    let signatureFile = new Blob([signature], { type: 'text/html' });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(signatureFile);
    a.download = fileName + "." + fileExtension + ".p7s";
    a.click();
}

function additionSelectOptions() {
    cadesplugin.async_spawn(function* (args) {
        var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
        yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE,
            CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);

        var certsList = yield oStore.Certificates;
        var certsCount = yield certsList.Count;

        var regExp = /CN=.*/;
        for (var i = 1; i <= certsCount; i++) {
            try {
                cert = yield certsList.Item(i);
                var str = yield cert.SubjectName;
                var resultString = str.match(regExp)[0];
                var firstcomma = resultString.indexOf(',');
                if (firstcomma == -1) firstcomma = resultString.length - 1;
                resultString = resultString.slice(3, firstcomma);
                $('#CertNameSelect').prepend($('<option>' + resultString + '</option>'));
            }
            catch (ex) {
                alert("Ошибка при перечислении сертификатов: " + cadesplugin.getLastError(ex));
                return;
            }
        }
    });
}

function getHash() {
    cadesplugin.async_spawn(function* (args) {
        // Проверяем, работает ли File API
        if (window.FileReader) {
            // Браузер поддерживает File API.
        } else {
            alert('The File APIs are not fully supported in this browser.');
        }
        if (0 === document.getElementById("uploadFile").files.length) {
            alert("Не выбран файл для подписи!");
            return;
        }
        var oFile = document.getElementById("uploadFile").files[0];
        var oFReader = new FileReader();

        if (typeof (oFReader.readAsDataURL) != "function") {
            alert("Method readAsDataURL() is not supported in FileReader.");
            return;
        }

        oFReader.readAsDataURL(oFile);

        oFReader.onload = function (oFREvent) {
            cadesplugin.async_spawn(function* (args) {
                var header = ";base64,";
                var sFileData = oFREvent.target.result;
                var sBase64Data = sFileData.substr(sFileData.indexOf(header) + header.length);

                // Создаем объект CAdESCOM.HashedData
                var oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");
                yield oHashedData.propset_Algorithm(CADESCOM_HASH_ALGORITHM);
                yield oHashedData.propset_DataEncoding(CADESCOM_BASE64_TO_BINARY);
                yield oHashedData.Hash(sBase64Data);
                var hashValue = yield oHashedData.Value;
                document.getElementById("hash").innerHTML = hashValue;
            });
        };
    });
}

function setHashAlgorithm() {
    // https://cpdn.cryptopro.ru/content/cades/namespace_c_ad_e_s_c_o_m_c64bb9facc59333fe4815d569f2ca026_1c64bb9facc59333fe4815d569f2ca026.html
    CADESCOM_HASH_ALGORITHM = parseInt(document.getElementById("HashAlgorithmSelect").value);
}

$(document).ready(function () {
    var inputArea = document.getElementById('uploadFile');
    inputArea.addEventListener('change', function () {
        if (this.value) { // Если выбрали новый файл
            document.getElementById('signature').innerHTML = '';
            document.getElementById('hash').innerHTML = '';
        }
    })

    cadesplugin.then(() => { // Ожидание загрузки плагина
        additionSelectOptions();
    });
})