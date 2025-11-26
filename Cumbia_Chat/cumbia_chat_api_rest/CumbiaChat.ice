[["java:package:com.example.chat.generated"]]
module CumbiaChat {
    sequence<byte> AudioData;

    struct Message {
        string sender;
        string content;
        string type;
        string date;
    };

    sequence<Message> MessageList;
    sequence<string> StringList;

    interface ChatCallback {
        ["oneway"] void receiveMessage(Message msg, string groupName);
    };

    interface ChatService {
        bool login(string username, string password, ChatCallback* cb);
        void logout(string username);
        StringList getConnectedUsers();

        void createGroup(string groupName, string creator);
        StringList getGroups();
        bool joinGroup(string groupName, string username);

        void sendMessage(string content, string sender, string groupName, string type);
        void sendAudio(AudioData data, string sender, string groupName, string fileExtension);
        MessageList getHistory(string groupName);
    };
};