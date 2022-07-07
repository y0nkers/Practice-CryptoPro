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
            alert("Select the file.");
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

                var oCertName = document.getElementById("CertName");
                var sCertName = oCertName.value; // Здесь следует заполнить SubjectName сертификата
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
                    alert("Certificate not found: " + sCertName);
                    return;
                }
                var oCertificate = yield oCertificates.Item(1);
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                yield oSigner.propset_Certificate(oCertificate);
                yield oSigner.propset_CheckCertificate(true);

                var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                yield oSignedData.propset_ContentEncoding(CADESCOM_BASE64_TO_BINARY);
                yield oSignedData.propset_Content(sBase64Data);

                try {
                    var sSignedMessage = yield oSignedData.SignCades(oSigner, CADESCOM_CADES_BES, true);
                } catch (err) {
                    alert("Failed to create signature. Error: " + cadesplugin.getLastError(err));
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
                    alert("Signature verified");
                } catch (err) {
                    alert("Failed to verify signature. Error: " + cadesplugin.getLastError(err));
                    return;
                }
            });
        };
    });
}

function downloadSignature() {
    let signedFile = document.getElementById("uploadFile").files[0];
    const file = signedFile.name;
    const lastDot = file.lastIndexOf('.');
    const fileName = file.substring(0, lastDot);
    const fileExtension = file.substring(lastDot + 1);

    let signature = document.getElementById("signature").innerHTML;
    let signatureFile = new Blob([signature], { type: 'text/html' });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(signatureFile);
    a.download = fileName + "." + fileExtension + ".p7s";
    a.click();
}

function updateSign() {
    alert("Файл успешно подписан!");
}