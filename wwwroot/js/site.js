var CADESCOM_CADES_BES = 1;
var CAPICOM_CURRENT_USER_STORE = 2;
var CAPICOM_MY_STORE = "My";
var CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2;
var CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME = 1;
var CADESCOM_BASE64_TO_BINARY = 1;

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

                var CADESCOM_HASH_ALGORITHM_CP_GOST_3411 = 100
                // Создаем объект CAdESCOM.HashedData
                var oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");
                oHashedData.propset_Algorithm(CADESCOM_HASH_ALGORITHM_CP_GOST_3411);
                oHashedData.propset_DataEncoding(CADESCOM_BASE64_TO_BINARY);
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
                //yield oSignedData.propset_Content(sBase64Data);
                yield oSignedData.propset_Content(hashValue);

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
                    yield oSignedData2.propset_Content(hashValue);
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

    let signedFile = document.getElementById("uploadFile").files[0];
    const file = signedFile.name;
    const lastDot = file.lastIndexOf('.');
    const fileName = file.substring(0, lastDot);
    const fileExtension = file.substring(lastDot + 1);

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
                console.log("CERT NAME: " + str);
                var resultString = str.match(regExp)[0];
                var firstcomma = resultString.indexOf(',');
                if (firstcomma == -1) firstcomma = resultString.length - 1;
                resultString = resultString.slice(3, firstcomma);
                console.log("RESULT: " + resultString);
                $('#CertNameSelect').prepend($('<option>' + resultString + '</option>'));
            }
            catch (ex) {
                alert("Ошибка при перечислении сертификатов: " + cadesplugin.getLastError(ex));
                return;
            }
        }
    });
}


$(document).ready(function () {
    var inputArea = document.getElementById('uploadFile');
    inputArea.addEventListener('change', function () {
        var signatureResult = document.getElementById('signature');
        if (this.value) { // Если выбрали новый файл
            signatureResult.innerHTML = '';
        }
    })

    cadesplugin.then(() => { // Ожидание загрузки плагина
        additionSelectOptions();
    });
})