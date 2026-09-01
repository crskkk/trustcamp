using NUnit.Framework;
using TrustCamp.Avatar;

public class AvatarScaffoldEditTests
{
    [Test]
    public void AvatarSpec_JSONRoundTrip_PreservesAllFields()
    {
        // Arrange
        var original = new AvatarSpec
        {
            skinTone = 2,
            hairStyle = 1,
            hairColor = 3,
            eyeColor = 4,
            expression = 1,
            bodyAccent = 2,
            version = 1
        };

        // Act
        string json = original.ToJSON();
        AvatarSpec recovered = AvatarSpec.FromJSON(json);

        // Assert
        Assert.AreEqual(original.skinTone, recovered.skinTone);
        Assert.AreEqual(original.hairStyle, recovered.hairStyle);
        Assert.AreEqual(original.hairColor, recovered.hairColor);
        Assert.AreEqual(original.eyeColor, recovered.eyeColor);
        Assert.AreEqual(original.expression, recovered.expression);
        Assert.AreEqual(original.bodyAccent, recovered.bodyAccent);
        Assert.AreEqual(original.version, recovered.version);
    }

    [Test]
    public void AvatarSpec_JSONRoundTrip_ReSerializesIdentically()
    {
        // Arrange
        var spec = new AvatarSpec
        {
            skinTone = 1,
            hairStyle = 2,
            hairColor = 3,
            eyeColor = 0,
            expression = 2,
            bodyAccent = 3,
            version = 1
        };

        // Act
        string json1 = spec.ToJSON();
        AvatarSpec recovered = AvatarSpec.FromJSON(json1);
        string json2 = recovered.ToJSON();

        // Assert
        Assert.AreEqual(json1, json2, "Re-serialized JSON should match original");
    }

    [Test]
    public void AvatarSpec_FieldRanges_AreValid()
    {
        // Arrange & Act
        var spec = new AvatarSpec
        {
            skinTone = 4,
            hairStyle = 4,
            hairColor = 4,
            eyeColor = 4,
            expression = 3,
            bodyAccent = 3,
            version = 1
        };

        // Assert
        Assert.GreaterOrEqual(spec.skinTone, 0);
        Assert.LessOrEqual(spec.skinTone, 4);
        Assert.GreaterOrEqual(spec.hairStyle, 0);
        Assert.LessOrEqual(spec.hairStyle, 4);
        Assert.GreaterOrEqual(spec.hairColor, 0);
        Assert.LessOrEqual(spec.hairColor, 4);
        Assert.GreaterOrEqual(spec.eyeColor, 0);
        Assert.LessOrEqual(spec.eyeColor, 4);
        Assert.GreaterOrEqual(spec.expression, 0);
        Assert.LessOrEqual(spec.expression, 3);
        Assert.GreaterOrEqual(spec.bodyAccent, 0);
        Assert.LessOrEqual(spec.bodyAccent, 3);
    }

    [Test]
    public void AvatarSpec_ToString_IncludesAllFields()
    {
        // Arrange
        var spec = new AvatarSpec
        {
            skinTone = 1,
            hairStyle = 2,
            hairColor = 3,
            eyeColor = 4,
            expression = 1,
            bodyAccent = 2,
            version = 1
        };

        // Act
        string str = spec.ToString();

        // Assert
        Assert.That(str, Does.Contain("AvatarSpec"));
        Assert.That(str, Does.Contain("skin=1"));
        Assert.That(str, Does.Contain("hair=2/3"));
        Assert.That(str, Does.Contain("eyes=4"));
        Assert.That(str, Does.Contain("expr=1"));
        Assert.That(str, Does.Contain("accent=2"));
    }
}
